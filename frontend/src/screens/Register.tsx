import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { Icon } from '../components/icons';
import { Button, Input, PasswordInput, ErrorBanner } from '../components/primitives';
import { FONTS } from '../tokens';

function validateUsername(v: string): string {
  if (v.length < 3) return '用户名至少 3 个字符';
  if (v.length > 30) return '用户名最多 30 个字符';
  if (!/^[a-zA-Z0-9_]+$/.test(v)) return '仅支持字母、数字和下划线';
  return '';
}

export default function Register() {
  const { t } = useTheme();
  const { register } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState({ username: false, password: false, confirm: false });

  const usernameError = touched.username ? validateUsername(username) : '';
  const passwordError = touched.password && password.length < 8 ? '密码至少 8 个字符' : '';
  const confirmError = touched.confirm && confirm !== password ? '两次密码不一致' : '';

  const valid = !validateUsername(username) && password.length >= 8 && confirm === password;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ username: true, password: true, confirm: true });
    if (!valid) return;
    setError('');
    setLoading(true);
    try {
      await register(username.trim(), password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Username already taken') || msg.includes('409')) {
        setError('该用户名已被使用，请换一个');
      } else if (msg.includes('Password must be at least 8 characters')) {
        setError('密码至少需要 8 个字符');
      } else if (msg.toLowerCase().includes('failed to fetch') || msg.includes('NetworkError')) {
        setError('网络异常，请检查连接后重试');
      } else {
        setError(msg || '注册失败，请重试');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh', background: t.appBg,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: '60px 24px 0' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, marginBottom: 24,
          background: `linear-gradient(135deg, ${t.brand} 0%, ${t.brandDeep} 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="sparkle" size={28} color="#fff" strokeWidth={1.5} />
        </div>
        <div style={{ fontFamily: FONTS.display, fontSize: 28, fontWeight: 700, color: t.textPrimary, marginBottom: 6 }}>
          创建账号
        </div>
        <div style={{ fontSize: 15, color: t.textSecondary }}>开始管理您的 NZ GST 小票</div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ flex: 1, padding: '40px 24px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && <ErrorBanner t={t} message={error} />}

        <Input
          t={t}
          label="用户名"
          value={username}
          onChange={v => { setUsername(v); setTouched(p => ({ ...p, username: true })); }}
          placeholder="3-30 字符，字母数字下划线"
          icon="user"
          error={usernameError}
        />

        <PasswordInput
          t={t}
          label="密码"
          value={password}
          onChange={v => { setPassword(v); setTouched(p => ({ ...p, password: true })); }}
          placeholder="至少 8 个字符"
          error={passwordError}
        />

        <PasswordInput
          t={t}
          label="确认密码"
          value={confirm}
          onChange={v => { setConfirm(v); setTouched(p => ({ ...p, confirm: true })); }}
          placeholder="再次输入密码"
          error={confirmError}
        />

        {/* Strength hints */}
        {password.length > 0 && (
          <div style={{ display: 'flex', gap: 4 }}>
            {[1, 2, 3, 4].map(level => {
              const strength = Math.min(4, Math.floor(password.length / 3));
              const color = strength >= level
                ? (strength <= 1 ? t.danger : strength <= 2 ? t.warning : strength <= 3 ? t.brand : t.success)
                : t.surfaceMuted;
              return <div key={level} style={{ flex: 1, height: 3, borderRadius: 2, background: color, transition: 'background 0.2s' }} />;
            })}
          </div>
        )}

        <div style={{ marginTop: 8 }}>
          <Button t={t} variant="primary" size="lg" block loading={loading} type="submit">
            注册
          </Button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 14, color: t.textSecondary }}>
          已有账号？{' '}
          <Link to="/login" style={{ color: t.brand, fontWeight: 600, textDecoration: 'none' }}>
            直接登录
          </Link>
        </div>
      </form>
    </div>
  );
}
