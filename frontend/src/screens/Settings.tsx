import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { Icon } from '../components/icons';
import {
  Screen, Body, Card, TabBar,
} from '../components/primitives';

export default function Settings() {
  const { t, mode, toggle } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch { /* ignore */ }
    navigate('/');
  };

  const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ padding: '14px 16px 0' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: t.textTertiary, letterSpacing: 0.5, textTransform: 'uppercase', padding: '0 4px 8px' }}>{label}</div>
      {children}
    </div>
  );

  const Row = ({ icon, label, value, onClick, danger }: {
    icon: string; label: string; value?: string; onClick?: () => void; danger?: boolean;
  }) => (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: danger ? '#FEE2E2' : t.surfaceMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon as any} size={16} color={danger ? '#EF4444' : t.textSecondary} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: danger ? '#EF4444' : t.textPrimary }}>{label}</div>
        {value && <div style={{ fontSize: 12, color: t.textTertiary, marginTop: 1 }}>{value}</div>}
      </div>
      {onClick && !danger && <Icon name="chevR" size={14} color={t.textTertiary} />}
    </div>
  );

  return (
    <Screen t={t}>

      {/* Header */}
      <div style={{ padding: '16px 16px 12px', background: t.surface, borderBottom: `1px solid ${t.border}` }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: t.textPrimary, letterSpacing: -0.4 }}>设置</div>
      </div>

      <Body style={{ paddingBottom: 100 }}>

        {/* Account */}
        <Section label="账号">
          <Card t={t} style={{ padding: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px' }}>
              <div style={{ width: 44, height: 44, borderRadius: 22, background: t.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>
                  {user?.username?.[0]?.toUpperCase() ?? 'U'}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: t.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.username ?? '—'}
                </div>
                <div style={{ fontSize: 12, color: t.textTertiary, marginTop: 2 }}>
                  注册时间: {user?.created_at ? user.created_at.slice(0, 10) : '—'}
                </div>
              </div>
            </div>
          </Card>
        </Section>

        {/* Preferences */}
        <Section label="偏好">
          <Card t={t} style={{ padding: 0 }}>
            <div onClick={toggle} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', borderBottom: `1px solid ${t.divider}` }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: t.surfaceMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={mode === 'dark' ? 'sun' : 'moon'} size={16} color={t.textSecondary} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: t.textPrimary }}>外观模式</div>
                <div style={{ fontSize: 12, color: t.textTertiary, marginTop: 1 }}>{mode === 'dark' ? '深色模式' : '浅色模式'}</div>
              </div>
              <div style={{ fontSize: 12, color: t.textTertiary, background: t.surfaceMuted, padding: '3px 10px', borderRadius: 999 }}>
                {mode === 'dark' ? '深色' : '浅色'}
              </div>
            </div>
            <Row icon="category" label="类别管理" onClick={() => navigate('/categories')} />
          </Card>
        </Section>

        {/* Data & Privacy */}
        <Section label="数据与隐私">
          <Card t={t} style={{ padding: 0 }}>
            <div style={{ borderBottom: `1px solid ${t.divider}` }}>
              <Row icon="shield" label="数据存储" value="加密保存在 Cloudflare 全球边缘网络" />
            </div>
            <div style={{ borderBottom: `1px solid ${t.divider}` }}>
              <Row icon="lock" label="图片存储" value="原始图片加密存储，仅本人可访问" />
            </div>
            <Row icon="info" label="税务声明" value="本应用仅供参考，不构成专业税务建议" />
          </Card>
        </Section>

        {/* About */}
        <Section label="关于">
          <Card t={t} style={{ padding: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${t.divider}` }}>
              <div style={{ flex: 1, fontSize: 14, color: t.textPrimary }}>版本</div>
              <div style={{ fontSize: 13, color: t.textTertiary }}>1.0.0</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
              <div style={{ flex: 1, fontSize: 14, color: t.textPrimary }}>GST 税率</div>
              <div style={{ fontSize: 13, color: t.textTertiary }}>15% (新西兰)</div>
            </div>
          </Card>
        </Section>

        {/* Logout */}
        <div style={{ padding: '14px 16px 0' }}>
          <Card t={t} style={{ padding: 0 }}>
            <div onClick={loggingOut ? undefined : handleLogout} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
              cursor: loggingOut ? 'default' : 'pointer', opacity: loggingOut ? 0.5 : 1,
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="logout" size={16} color="#EF4444" />
              </div>
              <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#EF4444' }}>
                {loggingOut ? '退出中…' : '退出登录'}
              </div>
            </div>
          </Card>
        </div>

        <div style={{ height: 16 }} />
      </Body>

      <TabBar t={t} current="me" onChange={s => {
        if (s === 'capture') navigate('/upload');
        else if (s === 'home') navigate('/dashboard');
        else if (s === 'list') navigate('/list');
        else if (s === 'report') navigate('/report');
      }} />

    </Screen>
  );
}
