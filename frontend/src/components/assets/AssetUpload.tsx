import { useRef, useState } from 'react';
import { api } from '../../services/api';
import { useProjectStore } from '../../state/projectStore';

interface AssetUploadProps {
  projectId: string;
  onUploaded?: () => void;
}

export function AssetUpload({ projectId, onUploaded }: AssetUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const { loadAssets } = useProjectStore();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setProgress(0);

    try {
      const { url, assetId } = await api.assets.getPresignedUrl({
        projectId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });

      await uploadToStorage(url, file, setProgress);

      await api.assets.confirmUpload({ assetId, projectId });

      await loadAssets(projectId);
      onUploaded?.();
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="p-3 border-b border-border">
      <input
        ref={fileRef}
        type="file"
        accept="video/*,audio/*,image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={uploading}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full py-2 px-3 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {uploading ? (
          <>
            <span className="animate-spin">⟳</span>
            Uploading {progress}%
          </>
        ) : (
          <>+ Upload Media</>
        )}
      </button>
      {uploading && (
        <div className="mt-2 h-1 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

async function uploadToStorage(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(file);
  });
}
