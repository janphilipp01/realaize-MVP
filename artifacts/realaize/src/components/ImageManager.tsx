import React, { useRef, useState } from 'react';
import { Upload, X, Star, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { ProjectImage } from '../models/types';

interface ImageManagerProps {
  entityId: string;
  entityType: 'Asset' | 'Deal' | 'Development' | 'Sale';
  compact?: boolean;
}

export default function ImageManager({ entityId, entityType, compact = false }: ImageManagerProps) {
  const { images, addImage, setTitleImage, deleteImage } = useStore();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const entityImages = images.filter(img => img.entityId === entityId);
  const titleImage = entityImages.find(img => img.isTitleImage);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        const newImg: ProjectImage = {
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          entityId,
          entityType,
          url,
          name: file.name,
          isTitleImage: entityImages.length === 0,
          uploadedAt: new Date().toISOString(),
        };
        addImage(newImg);
      };
      reader.readAsDataURL(file);
    });
  };

  if (compact && titleImage) {
    return (
      <div
        style={{
          width: '100%', height: 200, borderRadius: 16, overflow: 'hidden',
          position: 'relative', background: 'rgba(0,0,0,0.05)',
        }}
      >
        <img src={titleImage.url} alt={titleImage.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', bottom: 8, right: 8 }}>
          <button
            onClick={() => inputRef.current?.click()}
            style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, cursor: 'pointer', padding: '4px 8px', fontSize: 11, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Upload size={11} /> Bild wechseln
          </button>
          <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Title image display */}
      {titleImage && (
        <div style={{ marginBottom: 16, borderRadius: 16, overflow: 'hidden', position: 'relative', height: 220 }}>
          <img src={titleImage.url} alt={titleImage.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', top: 10, left: 10 }}>
            <span className="badge-accent" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <Star size={10} /> Titelbild
            </span>
          </div>
        </div>
      )}

      {/* Upload zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? 'rgba(0,122,255,0.5)' : 'rgba(0,0,0,0.12)'}`,
          borderRadius: 14,
          padding: 20,
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? 'rgba(0,122,255,0.05)' : 'rgba(0,0,0,0.02)',
          transition: 'all 0.2s',
          marginBottom: entityImages.length > 0 ? 12 : 0,
        }}
      >
        <Upload size={20} color="rgba(60,60,67,0.45)" style={{ margin: '0 auto 8px' }} />
        <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.60)', fontWeight: 500 }}>Bilder hochladen</div>
        <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.40)', marginTop: 2 }}>Drag & Drop oder klicken · JPG, PNG, WEBP</div>
        <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
      </div>

      {/* Image grid */}
      {entityImages.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {entityImages.map(img => (
            <div key={img.id} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '4/3' }}>
              <img src={img.url} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {img.isTitleImage && (
                <div style={{ position: 'absolute', top: 4, left: 4 }}>
                  <span style={{ background: 'rgba(0,122,255,0.85)', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: 4, padding: '2px 5px' }}>✦ TITEL</span>
                </div>
              )}
              <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 3 }}>
                {!img.isTitleImage && (
                  <button
                    onClick={() => setTitleImage(entityId, img.id)}
                    style={{ background: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: 5, cursor: 'pointer', padding: '3px 5px' }}
                    title="Als Titelbild setzen"
                  >
                    <Star size={10} color="#ff9500" />
                  </button>
                )}
                <button
                  onClick={() => deleteImage(img.id)}
                  style={{ background: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: 5, cursor: 'pointer', padding: '3px 5px' }}
                >
                  <Trash2 size={10} color="#cc1a14" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Compact title image display for cards/headers
export function TitleImageDisplay({ entityId, height = 180 }: { entityId: string; height?: number }) {
  const { images } = useStore();
  const titleImage = images.find(img => img.entityId === entityId && img.isTitleImage);

  if (!titleImage) return (
    <div style={{ height, background: 'linear-gradient(135deg, rgba(0,122,255,0.06), rgba(175,82,222,0.06))', borderRadius: '16px 16px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <ImageIcon size={28} color="rgba(60,60,67,0.25)" />
    </div>
  );

  return (
    <div style={{ height, borderRadius: '16px 16px 0 0', overflow: 'hidden' }}>
      <img src={titleImage.url} alt="Titelbild" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
}
