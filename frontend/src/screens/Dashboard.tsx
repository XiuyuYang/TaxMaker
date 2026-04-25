import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { api, Receipt, GSTSummary, Category } from '../api/client';
import { Icon } from '../components/icons';
import {
  Screen, Body, Card, Chip, TabBar,
  CategoryDot, EmptyState, SkeletonCard, nz,
} from '../components/primitives';
import { FONTS } from '../tokens';

function getCurrentNZPeriod(): { start: string; end: string; label: string } {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();
  // NZ bimonthly GST periods: Jan-Feb, Mar-Apr, May-Jun, Jul-Aug, Sep-Oct, Nov-Dec
  const periodIndex = Math.floor(month / 2);
  const startMonth = periodIndex * 2;
  const endMonth = startMonth + 1;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, endMonth + 1, 0);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  return {
    start: fmt(start),
    end: fmt(end),
    label: `${year} ${months[startMonth]} – ${months[endMonth]}`,
  };
}

function statusTone(status: Receipt['status']): 'brand' | 'success' | 'danger' | 'warn' | 'default' {
  if (status === 'confirmed') return 'success';
  if (status === 'needs_review') return 'warn';
  if (status === 'failed') return 'danger';
  if (status === 'processing' || status === 'uploaded') return 'brand';
  return 'default';
}

function statusLabel(status: Receipt['status']): string {
  const map: Record<Receipt['status'], string> = {
    uploaded: '已上传', processing: '识别中', needs_review: '待确认', confirmed: '已确认', failed: '失败',
  };
  return map[status] ?? status;
}

export default function Dashboard() {
  const { t } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const period = getCurrentNZPeriod();

  const [summary, setSummary] = useState<GSTSummary | null>(null);
  const [recent, setRecent] = useState<Receipt[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, allRes, pendingRes, catsRes] = await Promise.all([
        api.reports.gstSummary(period.start, period.end).catch(() => null),
        api.receipts.list({ per_page: 5 }),
        api.receipts.list({ status: 'needs_review', per_page: 1 }),
        api.categories.list().catch(() => [] as Category[]),
      ]);
      setSummary(summaryRes);
      setRecent(allRes.receipts);
      setPendingCount(pendingRes.total);
      setCategories(catsRes);
    } catch {
      setRecent([]);
    } finally {
      setLoading(false);
    }
  }, [period.start, period.end]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const catName = (id: string | null) =>
    id ? (categories.find(c => c.id === id)?.name ?? '未分类') : '未分类';

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 6) return '夜深了';
    if (h < 12) return '早上好';
    if (h < 18) return '下午好';
    return '晚上好';
  };

  return (
    <Screen t={t}>

      {/* Header */}
      <div style={{ padding: '8px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, color: t.textTertiary }}>{greeting()}，</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: t.textPrimary, fontFamily: FONTS.display }}>
            {user?.username ?? '用户'}
          </div>
        </div>
        <button
          onClick={() => navigate('/settings')}
          style={{
            width: 40, height: 40, borderRadius: 20, background: t.surfaceMuted,
            border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
        >
          <Icon name="user" size={20} color={t.textSecondary} />
        </button>
      </div>

      <Body style={{ padding: '16px 16px 80px' }}>
        {/* GST Period Card */}
        <Card t={t} style={{
          background: `linear-gradient(135deg, ${t.brand} 0%, ${t.brandDeep} 100%)`,
          border: 'none', padding: '20px', marginBottom: 12, color: '#fff',
        }}>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>当前 GST 申报期</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 16, fontFamily: FONTS.display }}>{period.label}</div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div>
              <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>进项总额</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: FONTS.num }}>
                {loading ? '—' : nz(summary?.total_purchases_inclusive ?? 0)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>可抵扣 GST</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: FONTS.num }}>
                {loading ? '—' : nz(summary?.total_gst_claimable ?? 0)}
              </div>
            </div>
          </div>
        </Card>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          {[
            { label: '小票总数', value: loading ? '—' : String(summary?.receipt_count ?? 0), icon: 'receipt', color: t.brand, onClick: () => navigate('/list') },
            { label: '待确认', value: loading ? '—' : String(pendingCount), icon: 'edit', color: t.warning, onClick: () => navigate('/list?status=needs_review') },
            { label: '特殊调整', value: loading ? '—' : String(summary?.special_adjustments_count ?? 0), icon: 'category', color: t.accent, onClick: () => navigate('/report') },
          ].map(({ label, value, icon, color, onClick }) => (
            <Card key={label} t={t} onClick={onClick} style={{ padding: '14px 12px', textAlign: 'center', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                <Icon name={icon} size={20} color={color} strokeWidth={2} />
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: t.textPrimary, fontFamily: FONTS.num }}>{value}</div>
              <div style={{ fontSize: 11, color: t.textTertiary, marginTop: 2 }}>{label}</div>
            </Card>
          ))}
        </div>

        {/* Quick actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <button
            onClick={() => navigate('/upload')}
            style={{
              background: t.brand, color: '#fff', border: 'none', borderRadius: 12,
              padding: '16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            }}
          >
            <Icon name="camera" size={22} color="#fff" strokeWidth={2} />
            <span style={{ fontSize: 15, fontWeight: 600 }}>拍摄上传</span>
          </button>
          <button
            onClick={() => navigate('/report')}
            style={{
              background: t.surface, color: t.textPrimary, border: `1px solid ${t.border}`,
              borderRadius: 12, padding: '16px', display: 'flex', alignItems: 'center', gap: 10,
              cursor: 'pointer', boxShadow: t.shadowCard,
            }}
          >
            <Icon name="download" size={22} color={t.accent} strokeWidth={2} />
            <span style={{ fontSize: 15, fontWeight: 600 }}>导出报表</span>
          </button>
        </div>

        {/* Recent receipts */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.textPrimary }}>最近小票</div>
          <button
            onClick={() => navigate('/list')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.brand, fontSize: 14, fontWeight: 500 }}
          >
            全部 →
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => <SkeletonCard key={i} t={t} lines={3} />)}
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            t={t} icon="receipt" title="还没有小票"
            subtitle="拍照上传您的第一张小票，AI 自动识别金额和分类"
            ctaLabel="立即上传" onCta={() => navigate('/upload')}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recent.map(r => (
              <Card
                key={r.id} t={t}
                onClick={() => navigate(r.status === 'confirmed' ? `/detail/${r.id}` : `/confirm/${r.id}`)}
                style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <CategoryDot name={catName(r.final_category_id ?? r.suggested_category_id)} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: t.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.merchant_name ?? '未知商户'}
                  </div>
                  <div style={{ fontSize: 12, color: t.textTertiary, marginTop: 2 }}>
                    {r.receipt_date ? r.receipt_date.replace(/\//g, '-').slice(0, 10) : '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: t.textPrimary, fontFamily: FONTS.num }}>
                    {r.total_amount != null ? nz(r.total_amount) : '—'}
                  </div>
                  <Chip t={t} label={statusLabel(r.status)} tone={statusTone(r.status)} size="sm" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </Body>

      <TabBar t={t} current="home" onChange={tab => {
        if (tab === 'home') return;
        if (tab === 'list') navigate('/list');
        if (tab === 'capture') navigate('/upload');
        if (tab === 'report') navigate('/report');
        if (tab === 'me') navigate('/settings');
      }} />
    </Screen>
  );
}
