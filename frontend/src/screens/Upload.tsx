import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { api } from '../api/client';
import { Icon } from '../components/icons';
import { Screen, Body, Button, ErrorBanner, TabBar } from '../components/primitives';
import { FONTS } from '../tokens';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export default function Upload() {
  const { t } = useTheme();
  const navigate = useNavigate();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [source, setSource] = useState<'camera' | 'gallery'>('gallery');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File, src: 'camera' | 'gallery' = 'gallery') => {
    setError('');
    if (f.size > MAX_SIZE) {
      setError('文件大小不能超过 10MB');
      return;
    }
    setFile(f);
    setSource(src);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const handleCamera = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f, 'camera');
  };

  const handleGallery = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f, 'gallery');
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const receipt = await api.receipts.upload(file, source);
      navigate(`/confirm/${receipt.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败，请重试');
      setUploading(false);
    }
  };

  return (
    <Screen t={t}>

      {/* Header */}
      <div style={{ padding: '8px 20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{ background: t.surfaceMuted, border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <Icon name="chevL" size={20} color={t.textPrimary} />
        </button>
        <div style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 700, color: t.textPrimary }}>
          上传小票
        </div>
      </div>

      <Body style={{ padding: '0 20px 80px' }}>
        {error && <div style={{ marginBottom: 16 }}><ErrorBanner t={t} message={error} /></div>}

        {/* Upload area */}
        {!preview ? (
          <div
            onClick={() => galleryRef.current?.click()}
            style={{
              border: `2px dashed ${t.brand}55`, borderRadius: 20,
              minHeight: 260, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 16,
              background: t.brandSoft, cursor: 'pointer', padding: 32,
              marginBottom: 24,
            }}
          >
            <div style={{
              width: 72, height: 72, borderRadius: 20, background: t.brand + '22',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="upload" size={32} color={t.brand} strokeWidth={1.8} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: t.textPrimary, marginBottom: 6 }}>点击选择小票图片</div>
              <div style={{ fontSize: 13, color: t.textSecondary }}>支持 JPG、PNG、WebP，最大 10MB</div>
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 24, position: 'relative', borderRadius: 16, overflow: 'hidden', boxShadow: t.shadowLift }}>
            <img
              src={preview}
              alt="小票预览"
              style={{ width: '100%', maxHeight: 380, objectFit: 'contain', display: 'block', background: t.surfaceMuted }}
            />
            <button
              onClick={() => { setFile(null); setPreview(null); setError(''); }}
              style={{
                position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: 16,
                background: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon name="close" size={16} color="#fff" strokeWidth={2.5} />
            </button>
            <div style={{
              position: 'absolute', bottom: 12, left: 12, background: 'rgba(0,0,0,0.55)',
              color: '#fff', borderRadius: 8, padding: '4px 10px', fontSize: 12,
            }}>
              {file?.name} · {(file!.size / 1024).toFixed(0)} KB
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => cameraRef.current?.click()}
            style={{
              background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12,
              padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 8, cursor: 'pointer', boxShadow: t.shadowCard,
            }}
          >
            <Icon name="camera" size={28} color={t.brand} strokeWidth={2} />
            <span style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary }}>拍照</span>
            <span style={{ fontSize: 11, color: t.textTertiary }}>调用摄像头</span>
          </button>
          <button
            onClick={() => galleryRef.current?.click()}
            style={{
              background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12,
              padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 8, cursor: 'pointer', boxShadow: t.shadowCard,
            }}
          >
            <Icon name="gallery" size={28} color={t.accent} strokeWidth={2} />
            <span style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary }}>从相册选择</span>
            <span style={{ fontSize: 11, color: t.textTertiary }}>JPG / PNG / WebP</span>
          </button>
        </div>

        {/* Tips */}
        <div style={{
          background: t.brandSoft, borderRadius: 12, padding: '14px 16px',
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <Icon name="info" size={16} color={t.brand} strokeWidth={2} />
          <div style={{ fontSize: 13, color: t.brand, lineHeight: 1.6 }}>
            拍摄时请确保小票清晰，AI 将自动识别商户名称、日期、总额及 GST 金额
          </div>
        </div>

        {/* Upload button */}
        <div style={{ marginTop: 24 }}>
          <Button
            t={t} variant="primary" size="lg" block
            disabled={!file || uploading}
            loading={uploading}
            onClick={handleUpload}
            icon="upload"
          >
            {uploading ? 'AI 识别中…' : '上传并识别'}
          </Button>
        </div>
      </Body>

      {/* Hidden inputs */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleCamera} />
      <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleGallery} />

      <TabBar t={t} current="capture" onChange={s => {
        if (s === 'home') navigate('/dashboard');
        else if (s === 'list') navigate('/list');
        else if (s === 'report') navigate('/report');
        else if (s === 'me') navigate('/settings');
      }} />
    </Screen>
  );
}
