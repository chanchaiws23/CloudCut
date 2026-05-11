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
      const { assetId, url } = await api.assets.getPresignedUrl({
        projectId,
        fileName: file.name,
        type: file.type.split('/')[0] as 'video' | 'audio' | 'image',
      });

      await uploadToBackend(url, file, setProgress);

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

async function uploadToBackend(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  const token = localStorage.getItem('cloudcut_token') || '';
  const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  const fullUrl = url.startsWith('http') ? url : `${BASE}${url}`;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', fullUrl);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('Network error'));
    const formData = new FormData();
    formData.append('file', file);
    xhr.send(formData);
  });
}
