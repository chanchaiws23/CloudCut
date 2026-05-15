import { useRef, useState } from 'react';
import { api, getAccessToken } from '../../services/api';
import { useProjectStore } from '../../state/projectStore';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '../ui/button';

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
      const uploadTarget = await api.assets.getPresignedUrl({
        projectId,
        fileName: file.name,
        type: file.type.split('/')[0] as 'video' | 'audio' | 'image',
        contentType: file.type,
      });

      if (uploadTarget.uploadMode === 'presigned') {
        await uploadToPresignedUrl(uploadTarget.url, file, uploadTarget.headers, setProgress);
        await api.assets.confirmUpload({ projectId, assetId: uploadTarget.assetId });
      } else {
        await uploadToBackend(uploadTarget.url, file, setProgress);
      }

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
      <Button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full"
      >
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading {progress}%
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            Upload Media
          </>
        )}
      </Button>
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

async function uploadToPresignedUrl(
  url: string,
  file: File,
  headers: Record<string, string> | undefined,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    Object.entries(headers || { 'Content-Type': file.type }).forEach(([key, value]) => {
      if (value) xhr.setRequestHeader(key, value);
    });
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(file);
  });
}

async function uploadToBackend(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  const token = getAccessToken();
  const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  const fullUrl = url.startsWith('http') ? url : `${BASE}${url}`;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', fullUrl);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
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
