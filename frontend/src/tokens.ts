export const TOKENS = {
  light: {
    appBg: '#F4F5F7', surface: '#FFFFFF', surfaceAlt: '#F8F9FB', surfaceMuted: '#EEF1F4',
    textPrimary: '#0B1F2A', textSecondary: '#556676', textTertiary: '#8A98A3', textInverse: '#FFFFFF',
    brand: '#13B5B1', brandDeep: '#0E8F8C', brandSoft: '#E6F7F7',
    accent: '#F2704E', accentSoft: '#FDECE4',
    success: '#2FA86B', successSoft: '#E3F4EA',
    warning: '#E0A62B', warningSoft: '#FBF1DA',
    danger: '#D94F4F', dangerSoft: '#FBE6E6',
    border: '#E4E8ED', borderStrong: '#CBD2D9', divider: 'rgba(11,31,42,0.08)',
    shadowCard: '0 1px 2px rgba(11,31,42,0.04), 0 2px 8px rgba(11,31,42,0.04)',
    shadowLift: '0 2px 4px rgba(11,31,42,0.06), 0 12px 32px rgba(11,31,42,0.08)',
  },
  dark: {
    appBg: '#0B1216', surface: '#151D23', surfaceAlt: '#1A232A', surfaceMuted: '#202A32',
    textPrimary: '#EAF0F4', textSecondary: '#9AA8B3', textTertiary: '#6B7884', textInverse: '#0B1216',
    brand: '#2AD4CF', brandDeep: '#13B5B1', brandSoft: 'rgba(42,212,207,0.14)',
    accent: '#FF8863', accentSoft: 'rgba(255,136,99,0.14)',
    success: '#52C48A', successSoft: 'rgba(82,196,138,0.14)',
    warning: '#E8BC56', warningSoft: 'rgba(232,188,86,0.14)',
    danger: '#EC6B6B', dangerSoft: 'rgba(236,107,107,0.14)',
    border: '#27333C', borderStrong: '#37454F', divider: 'rgba(255,255,255,0.06)',
    shadowCard: '0 1px 2px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3)',
    shadowLift: '0 2px 4px rgba(0,0,0,0.5), 0 12px 32px rgba(0,0,0,0.45)',
  },
} as const;

export type Theme = typeof TOKENS.light | typeof TOKENS.dark;
export type ThemeMode = 'light' | 'dark';

export const FONTS = {
  ui: '-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","Helvetica Neue",system-ui,sans-serif',
  display: '-apple-system,BlinkMacSystemFont,"SF Pro Display","PingFang SC",system-ui,sans-serif',
  num: '"SF Pro Rounded",-apple-system,ui-rounded,system-ui,sans-serif',
  mono: '"SF Mono",ui-monospace,Menlo,monospace',
};

export const CAT_META: Record<string, { c: string; icon: string }> = {
  // NZ IRD 11 standard categories
  '办公文具':  { c: '#7B61FF', icon: 'briefcase' },
  '差旅住宿':  { c: '#E0A62B', icon: 'briefcase' },
  '车辆交通':  { c: '#3D8CF5', icon: 'car' },
  '餐饮招待':  { c: '#F2704E', icon: 'coffee' },
  '通讯网络':  { c: '#13B5B1', icon: 'send' },
  '专业服务':  { c: '#9B6BFF', icon: 'briefcase' },
  '设备技术':  { c: '#2196F3', icon: 'category' },
  '市场推广':  { c: '#D94F8A', icon: 'spark' },
  '培训教育':  { c: '#FF9800', icon: 'briefcase' },
  '租金水电':  { c: '#009688', icon: 'send' },
  '保险费用':  { c: '#607D8B', icon: 'briefcase' },
  // fallback
  '未分类':    { c: '#8A98A3', icon: 'tag' },
};
