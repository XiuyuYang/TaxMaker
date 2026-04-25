;
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { Icon } from '../components/icons';
import { Button } from '../components/primitives';
import { FONTS } from '../tokens';

export default function Landing() {
  const { t } = useTheme();
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100dvh', background: t.appBg,
      display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
    }}>
      {/* Background blobs */}
      <div style={{
        position: 'absolute', top: -120, right: -80, width: 320, height: 320,
        borderRadius: '50%', background: `radial-gradient(circle, ${t.brand}22 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: 60, left: -100, width: 280, height: 280,
        borderRadius: '50%', background: `radial-gradient(circle, ${t.accent}18 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Hero section */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px 20px' }}>
        {/* Logo */}
        <div style={{
          width: 96, height: 96, borderRadius: 26, marginBottom: 28,
          background: `linear-gradient(135deg, ${t.brand} 0%, ${t.brandDeep} 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 12px 40px ${t.brand}44`,
        }}>
          <Icon name="receipt" size={48} color="#fff" strokeWidth={1.5} />
        </div>

        {/* App name */}
        <div style={{
          fontFamily: FONTS.display, fontSize: 36, fontWeight: 700,
          color: t.textPrimary, marginBottom: 10, letterSpacing: -0.5,
        }}>
          小票管家
        </div>

        {/* Tagline */}
        <div style={{
          fontSize: 15, color: t.textSecondary, textAlign: 'center',
          lineHeight: 1.6, marginBottom: 40, maxWidth: 260,
        }}>
          新西兰 GST 小票管理<br />AI 自动识别 · 一键申报
        </div>

        {/* Feature bullets */}
        <div style={{
          background: t.surface, borderRadius: 16, border: `1px solid ${t.border}`,
          padding: '20px 24px', width: '100%', boxShadow: t.shadowCard,
          display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 40,
        }}>
          {[
            { icon: 'camera', text: '拍照上传 · AI 自动识别商户和金额', color: t.brand },
            { icon: 'chart', text: 'NZ GST 101A 申报表自动生成', color: t.accent },
            { icon: 'download', text: 'CSV 导出申报汇总，IRD 合规存档', color: t.success },
          ].map(({ icon, text, color }) => (
            <div key={icon} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: color + '18',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={icon} size={18} color={color} strokeWidth={2} />
              </div>
              <span style={{ fontSize: 14, color: t.textSecondary, lineHeight: 1.4 }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA buttons */}
      <div style={{ padding: '0 24px 48px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Button t={t} variant="primary" size="lg" block onClick={() => navigate('/register')}>
          免费注册
        </Button>
        <Button t={t} variant="secondary" size="lg" block onClick={() => navigate('/login')}>
          已有账号，登录
        </Button>
        <div style={{ textAlign: 'center', fontSize: 12, color: t.textTertiary, marginTop: 8 }}>
          数据存储符合 NZ Privacy Act 2020
        </div>
      </div>
    </div>
  );
}
