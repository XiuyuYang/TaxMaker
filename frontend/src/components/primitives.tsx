import React, { useState, useRef, useEffect } from 'react';
import { Theme, CAT_META, FONTS } from '../tokens';
import { Icon } from './icons';

// ─── Currency helpers ──────────────────────────────────────────────────────
export const fmt = (n: number, dp = 2) =>
  new Intl.NumberFormat('en-NZ', { minimumFractionDigits: dp, maximumFractionDigits: dp }).format(n);
export const nz = (n: number) => '$' + fmt(n);

// ─── Screen ───────────────────────────────────────────────────────────────
interface ScreenProps { t: Theme; children: React.ReactNode; style?: React.CSSProperties }
export function Screen({ t, children, style }: ScreenProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100dvh',
      background: t.appBg, overflow: 'hidden', ...style,
    }}>
      {children}
    </div>
  );
}

// ─── Body ─────────────────────────────────────────────────────────────────
interface BodyProps { children: React.ReactNode; style?: React.CSSProperties }
export function Body({ children, style }: BodyProps) {
  return (
    <div style={{
      flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' as const, ...style,
    }}>
      {children}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────
interface CardProps { t: Theme; children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void }
export function Card({ t, children, style, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: t.surface, borderRadius: 14, border: `1px solid ${t.border}`,
        boxShadow: t.shadowCard, ...style,
        cursor: onClick ? 'pointer' : undefined,
      }}
    >
      {children}
    </div>
  );
}

// ─── Chip ─────────────────────────────────────────────────────────────────
type ChipTone = 'default' | 'brand' | 'success' | 'warn' | 'danger' | 'accent';
type ChipSize = 'sm' | 'md';
interface ChipProps { t: Theme; label: string; tone?: ChipTone; icon?: string; size?: ChipSize }

export function Chip({ t, label, tone = 'default', icon, size = 'md' }: ChipProps) {
  const bg: Record<ChipTone, string> = {
    default: t.surfaceMuted, brand: t.brandSoft, success: t.successSoft,
    warn: t.warningSoft, danger: t.dangerSoft, accent: t.accentSoft,
  };
  const color: Record<ChipTone, string> = {
    default: t.textSecondary, brand: t.brand, success: t.success,
    warn: t.warning, danger: t.danger, accent: t.accent,
  };
  const pad = size === 'sm' ? '2px 8px' : '4px 10px';
  const fs = size === 'sm' ? 11 : 12;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: bg[tone], color: color[tone],
      borderRadius: 99, padding: pad, fontSize: fs, fontWeight: 600,
      whiteSpace: 'nowrap' as const,
    }}>
      {icon && <Icon name={icon} size={size === 'sm' ? 10 : 12} color={color[tone]} strokeWidth={2} />}
      {label}
    </span>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'soft' | 'danger';
type BtnSize = 'sm' | 'md' | 'lg';
interface ButtonProps {
  t: Theme; variant?: BtnVariant; size?: BtnSize; block?: boolean;
  icon?: string; iconRight?: string; onClick?: () => void;
  disabled?: boolean; loading?: boolean; children: React.ReactNode;
  type?: 'button' | 'submit' | 'reset'; style?: React.CSSProperties;
}

export function Button({ t, variant = 'primary', size = 'md', block, icon, iconRight, onClick, disabled, loading, children, type = 'button', style }: ButtonProps) {
  const bg: Record<BtnVariant, string> = {
    primary: t.brand, secondary: t.surface, ghost: 'transparent',
    soft: t.brandSoft, danger: t.danger,
  };
  const color: Record<BtnVariant, string> = {
    primary: '#fff', secondary: t.textPrimary, ghost: t.textSecondary,
    soft: t.brand, danger: '#fff',
  };
  const border: Record<BtnVariant, string> = {
    primary: 'none', secondary: `1px solid ${t.border}`, ghost: 'none',
    soft: 'none', danger: 'none',
  };
  const pad: Record<BtnSize, string> = { sm: '6px 14px', md: '10px 20px', lg: '14px 28px' };
  const fs: Record<BtnSize, number> = { sm: 13, md: 15, lg: 16 };
  const iconSz: Record<BtnSize, number> = { sm: 14, md: 16, lg: 18 };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        background: bg[variant], color: color[variant], border: border[variant],
        borderRadius: 10, padding: pad[size], fontSize: fs[size], fontWeight: 600,
        width: block ? '100%' : undefined, cursor: 'pointer',
        opacity: disabled || loading ? 0.55 : 1,
        fontFamily: FONTS.ui, transition: 'opacity 0.15s',
        ...style,
      }}
    >
      {loading ? <Spinner size={iconSz[size]} color={color[variant]} /> : icon && <Icon name={icon} size={iconSz[size]} color={color[variant]} strokeWidth={2} />}
      {children}
      {iconRight && !loading && <Icon name={iconRight} size={iconSz[size]} color={color[variant]} strokeWidth={2} />}
    </button>
  );
}

// ─── TabBar ───────────────────────────────────────────────────────────────
type TabItem = 'home' | 'list' | 'capture' | 'report' | 'me';
interface TabBarProps { t: Theme; current: TabItem; onChange: (tab: TabItem) => void }

export function TabBar({ t, current, onChange }: TabBarProps) {
  const tabs: { id: TabItem; icon: string; label: string }[] = [
    { id: 'home', icon: 'home', label: '概览' },
    { id: 'list', icon: 'receipt', label: '小票' },
    { id: 'capture', icon: 'camera', label: '' },
    { id: 'report', icon: 'chart', label: '报表' },
    { id: 'me', icon: 'user', label: '我的' },
  ];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      background: t.surface, borderTop: `1px solid ${t.border}`,
      paddingBottom: 'env(safe-area-inset-bottom, 0px)', paddingTop: 8,
      height: 64,
    }}>
      {tabs.map(tab => {
        if (tab.id === 'capture') {
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              style={{
                width: 52, height: 52, borderRadius: 26, background: t.brand,
                border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 14px ${t.brand}55`, cursor: 'pointer',
                marginBottom: 12,
              }}
            >
              <Icon name="camera" size={24} color="#fff" strokeWidth={2} />
            </button>
          );
        }
        const active = current === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              background: 'none', border: 'none', cursor: 'pointer',
              color: active ? t.brand : t.textTertiary, minWidth: 44, padding: '0 8px',
            }}
          >
            <Icon name={tab.icon} size={22} color={active ? t.brand : t.textTertiary} strokeWidth={active ? 2 : 1.6} />
            <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── CategoryDot ──────────────────────────────────────────────────────────
interface CategoryDotProps { name: string; size?: number }
export function CategoryDot({ name, size = 36 }: CategoryDotProps) {
  const meta = CAT_META[name] ?? { c: '#8A98A3', icon: 'tag' };
  return (
    <div style={{
      width: size, height: size, borderRadius: 8, background: meta.c + '22',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <Icon name={meta.icon} size={size * 0.5} color={meta.c} strokeWidth={2} />
    </div>
  );
}

// ─── StatusBar ────────────────────────────────────────────────────────────
interface StatusBarProps { t: Theme }
export function StatusBar({ t }: StatusBarProps) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 20px 6px', fontSize: 12, fontWeight: 600, color: t.textPrimary,
    }}>
      <span style={{ fontFamily: FONTS.num }}>9:41</span>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <svg width="16" height="12" viewBox="0 0 16 12" fill={t.textPrimary}><rect x="0" y="4" width="3" height="8" rx="1"/><rect x="4.5" y="2.5" width="3" height="9.5" rx="1"/><rect x="9" y="0.5" width="3" height="11.5" rx="1"/><rect x="13.5" y="0" width="2.5" height="12" rx="1"/></svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke={t.textPrimary} strokeWidth="1.5"><rect x="0.5" y="0.5" width="13" height="11" rx="1.5"/><path d="M14 4v4" strokeLinecap="round"/><rect x="2" y="2" width="9" height="7" rx="0.5" fill={t.textPrimary}/></svg>
      </div>
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────
interface SpinnerProps { size?: number; color?: string }
export function Spinner({ size = 20, color = '#13B5B1' }: SpinnerProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2.5" strokeOpacity="0.2"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────
type ToastTone = 'success' | 'error' | 'info';
interface ToastProps { t: Theme; message: string; tone?: ToastTone; onClose: () => void }
export function Toast({ t, message, tone = 'info', onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bg = tone === 'success' ? t.success : tone === 'error' ? t.danger : t.brand;
  const icon = tone === 'success' ? 'check' : tone === 'error' ? 'close' : 'info';
  return (
    <div style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      background: bg, color: '#fff', borderRadius: 12, padding: '12px 18px',
      display: 'flex', alignItems: 'center', gap: 8, zIndex: 9999,
      boxShadow: '0 8px 24px rgba(0,0,0,0.25)', fontSize: 14, fontWeight: 500,
      maxWidth: 360, whiteSpace: 'nowrap' as const,
    }}>
      <Icon name={icon} size={16} color="#fff" strokeWidth={2.5} />
      {message}
    </div>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────
interface InputProps {
  t: Theme; value: string; onChange: (v: string) => void;
  placeholder?: string; label?: string; type?: string;
  error?: string; disabled?: boolean; icon?: string;
}
export function Input({ t, value, onChange, placeholder, label, type = 'text', error, disabled, icon }: InputProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <label style={{ fontSize: 13, fontWeight: 600, color: t.textSecondary }}>{label}</label>}
      <div style={{ position: 'relative' }}>
        {icon && (
          <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <Icon name={icon} size={16} color={t.textTertiary} />
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            width: '100%', padding: icon ? '12px 14px 12px 38px' : '12px 14px',
            background: t.surfaceAlt, border: `1px solid ${error ? t.danger : t.border}`,
            borderRadius: 10, fontSize: 15, color: t.textPrimary, outline: 'none',
          }}
        />
      </div>
      {error && <span style={{ fontSize: 12, color: t.danger }}>{error}</span>}
    </div>
  );
}

// ─── PasswordInput ────────────────────────────────────────────────────────
interface PasswordInputProps {
  t: Theme; value: string; onChange: (v: string) => void;
  placeholder?: string; label?: string; error?: string;
}
export function PasswordInput({ t, value, onChange, placeholder, label, error }: PasswordInputProps) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <label style={{ fontSize: 13, fontWeight: 600, color: t.textSecondary }}>{label}</label>}
      <div style={{ position: 'relative' }}>
        <Icon name="lock" size={16} color={t.textTertiary} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' } as React.CSSProperties} />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%', padding: '12px 42px 12px 38px',
            background: t.surfaceAlt, border: `1px solid ${error ? t.danger : t.border}`,
            borderRadius: 10, fontSize: 15, color: t.textPrimary, outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          <Icon name={show ? 'eyeOff' : 'eye'} size={16} color={t.textTertiary} />
        </button>
      </div>
      {error && <span style={{ fontSize: 12, color: t.danger }}>{error}</span>}
    </div>
  );
}

// ─── ErrorBanner ──────────────────────────────────────────────────────────
interface ErrorBannerProps { t: Theme; message: string }
export function ErrorBanner({ t, message }: ErrorBannerProps) {
  return (
    <div style={{
      background: t.dangerSoft, border: `1px solid ${t.danger}33`,
      borderRadius: 10, padding: '12px 14px',
      display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      <Icon name="info" size={16} color={t.danger} strokeWidth={2} />
      <span style={{ fontSize: 14, color: t.danger, lineHeight: 1.5 }}>{message}</span>
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────
interface EmptyStateProps {
  t: Theme; icon?: string; title: string; subtitle?: string;
  ctaLabel?: string; onCta?: () => void;
}
export function EmptyState({ t, icon = 'receipt', title, subtitle, ctaLabel, onCta }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 32px', textAlign: 'center', gap: 12,
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 18, background: t.surfaceMuted,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8,
      }}>
        <Icon name={icon} size={32} color={t.textTertiary} />
      </div>
      <div style={{ fontSize: 17, fontWeight: 600, color: t.textPrimary }}>{title}</div>
      {subtitle && <div style={{ fontSize: 14, color: t.textSecondary, lineHeight: 1.5 }}>{subtitle}</div>}
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          style={{
            marginTop: 8, background: t.brand, color: '#fff',
            border: 'none', borderRadius: 10, padding: '10px 22px',
            fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

// ─── SkeletonCard ─────────────────────────────────────────────────────────
interface SkeletonCardProps { t: Theme; lines?: number }
export function SkeletonCard({ t, lines = 2 }: SkeletonCardProps) {
  return (
    <Card t={t} style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <style>{`@keyframes shimmer { 0%{opacity:1} 50%{opacity:0.4} 100%{opacity:1} }`}</style>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 14, borderRadius: 7, background: t.surfaceMuted,
            width: i === 0 ? '60%' : '40%',
            animation: 'shimmer 1.4s ease-in-out infinite',
          }}
        />
      ))}
    </Card>
  );
}

// ─── useToast ─────────────────────────────────────────────────────────────
interface ToastState { message: string; tone: ToastTone; id: number }
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const counter = useRef(0);
  const show = (message: string, tone: ToastTone = 'info') => {
    counter.current++;
    setToast({ message, tone, id: counter.current });
  };
  const hide = () => setToast(null);
  return { toast, show, hide };
}
