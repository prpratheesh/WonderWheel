import React, { useRef, useState } from 'react';
import { ImagePlus, Trash2, Upload } from 'lucide-react';
import { useImageUrl } from '../../hooks/useImageUrl';
import { loadImage } from '../../services/imageCache';
import {
  ACCEPT_ATTR,
  BACKGROUND_IMAGE_MAX_DIM,
  ImageUploadError,
  processUpload,
  SEGMENT_IMAGE_MAX_DIM,
  storeImage,
} from '../../services/imageStorage';

interface ImageUploaderProps {
  imageId: string | null;
  onChange: (newImageId: string | null) => void;
  variant?: 'segment' | 'background';
  compact?: boolean;
  label?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  imageId,
  onChange,
  variant = 'segment',
  compact = false,
  label,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const url = useImageUrl(imageId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const maxDim = variant === 'background' ? BACKGROUND_IMAGE_MAX_DIM : SEGMENT_IMAGE_MAX_DIM;
      const { blob, width, height } = await processUpload(file, maxDim);
      const rec = await storeImage(blob, width, height, file.name);
      await loadImage(rec.id);
      onChange(rec.id);
    } catch (err) {
      setError(err instanceof ImageUploadError ? err.message : 'Could not upload image.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className={`img-uploader ${compact ? 'img-uploader--compact' : ''}`}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="sr-only"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      {url ? (
        <div className="img-uploader__preview">
          <img
            src={url}
            alt={label ?? 'Uploaded preview'}
            onClick={() => inputRef.current?.click()}
            title="Click to replace image"
          />
          <div className="img-uploader__btns">
            <button
              type="button"
              className="btn btn--sm btn--secondary"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              <Upload size={14} />
              <span>Replace</span>
            </button>
            <button
              type="button"
              className="btn btn--sm btn--danger"
              onClick={() => onChange(null)}
              disabled={busy}
              aria-label="Remove image"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="img-uploader__drop"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          <ImagePlus size={compact ? 16 : 20} />
          <span>{busy ? 'Processing…' : label ?? (compact ? 'Image' : 'Upload JPG, PNG, WebP or SVG')}</span>
        </button>
      )}
      {error && <div className="field-error">{error}</div>}
    </div>
  );
};

