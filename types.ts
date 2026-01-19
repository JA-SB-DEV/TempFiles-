export interface TempFile {
  id: string;
  code: string;
  fileUrl: string;
  type: 'image' | 'video' | 'text' | 'audio';
  createdAt: number;
  expiresAt: number;
  mimeType: string;
  encryptionKey?: string; // Client-side key, not stored in DB
  options?: FileOptions;
}

export interface FileOptions {
  burnOnRead: boolean; // Delete after viewing
  durationMinutes: number;
  burnDelaySeconds?: number; // Time in seconds to view before burning
}

export interface UploadStatus {
  isUploading: boolean;
  progress: number;
  error?: string;
}