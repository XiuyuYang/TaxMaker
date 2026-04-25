import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { Icon } from '../components/icons';
import { Button, Input, PasswordInput, ErrorBanner } from '../components/primitives';
import { FONTS } from '../tokens';

export default function Login() {
  const { t } = useTheme();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请重试');
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
          <Icon name="receipt" size={28} color="#fff" strokeWidth={1.5} />
        </div>
        <div style={{ fontFamily: FONTS.display, fontSize: 28, fontWeight: 700, color: t.textPrimary, marginBottom: 6 }}>
          欢迎回来
        </div>
        <div style={{ fontSize: 15, color: t.textSecondary }}>登录您的小票管家账号</div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ flex: 1, padding: '40px 24px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && <ErrorBanner t={t} message={error} />}

        <Input
          t={t}
          label="用户名"
          value={username}
          onChange={setUsername}
          placeholder="输入用户名"
          icon="user"
        />

        <PasswordInput
          t={t}
          label="密码"
          value={password}
          onChange={setPassword}
          placeholder="输入密码"
        />

        <div style={{ marginTop: 8 }}>
          <Button t={t} variant="primary" size="lg" block loading={loading} type="submit">
            登录
          </Button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 14, color: t.textSecondary }}>
          没有账号？{' '}
          <Link to="/register" style={{ color: t.brand, fontWeight: 600, textDecoration: 'none' }}>
            立即注册
          </Link>
        </div>
      </form>
    </div>
  );
}
