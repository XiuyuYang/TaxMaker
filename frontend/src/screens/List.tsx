import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { api, Receipt, Category } from '../api/client';
import { Icon } from '../components/icons';
import {
  Screen, Body, Card, Chip, Button, TabBar,
  CategoryDot, EmptyState, SkeletonCard, nz,
} from '../components/primitives';
import { FONTS } from '../tokens';

type FilterStatus = 'all' | 'needs_review' | 'confirmed' | 'failed';

function statusLabel(s: Receipt['status']) {
  const m: Record<string, string> = {
    uploaded:'已上传', processing:'识别中', needs_review:'待确认', confirmed:'已确认', failed:'失败',
  };
  return m[s] ?? s;
}
function statusTone(s: Receipt['status']): 'brand'|'success'|'danger'|'warn'|'default' {
  if (s === 'confirmed') return 'success';
  if (s === 'needs_review') return 'warn';
  if (s === 'failed') return 'danger';
  if (s === 'processing' || s === 'uploaded') return 'brand';
  return 'default';
}

function normalizeDate(s: string): string {
  return s.replace(/\//g, '-').slice(0, 10);
}

function groupByDate(receipts: Receipt[]): Array<{ label: string; items: Receipt[] }> {
  const groups: Record<string, Receipt[]> = {};
  for (const r of receipts) {
    const d = normalizeDate(r.receipt_date ?? r.created_at.slice(0, 10));
    (groups[d] = groups[d] ?? []).push(r);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({
      label: formatDateLabel(date),
      items,
    }));
}

function formatDateLabel(iso: string) {
  const d = new Date(normalizeDate(iso) + 'T00:00:00');
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m}月 ${day}日`;
}

export default function List() {
  const { t } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const initialFilter = (['all', 'needs_review', 'confirmed', 'failed'].includes(searchParams.get('status') ?? ''))
    ? (searchParams.get('status') as FilterStatus)
    : 'all';
  const [filter, setFilter] = useState<FilterStatus>(initialFilter);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PER = 30;

  const fetchReceipts = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const params: { page: number; per_page: number; status?: string } = { page: pg, per_page: PER };
      if (filter !== 'all') params.status = filter;
      const res = await api.receipts.list(params);
      setReceipts(pg === 1 ? res.receipts : prev => [...prev, ...res.receipts]);
      setTotal(res.total);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    api.categories.list().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setPage(1);
    fetchReceipts(1);
  }, [filter, fetchReceipts]);

  const filtered = receipts.filter(r =>
    !search || r.merchant_name?.toLowerCase().includes(search.toLowerCase())
  );
  const grouped = groupByDate(filtered);

  const catName = (id: string | null) =>
    id ? (categories.find(c => c.id === id)?.name ?? '未分类') : '未分类';

  const handleClick = (r: Receipt) => {
    if (r.status === 'confirmed') navigate(`/detail/${r.id}`);
    else navigate(`/confirm/${r.id}`);
  };

  const filters: Array<{ id: FilterStatus; label: string }> = [
    { id: 'all', label: '全部' },
    { id: 'needs_review', label: '待确认' },
    { id: 'confirmed', label: '已确认' },
    { id: 'failed', label: '失败' },
  ];

  return (
    <Screen t={t}>

      {/* Header */}
      <div style={{ padding: '16px 16px 0', background: t.surface, borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: t.textTertiary, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.3 }}>
              共 {search ? filtered.length : total} 张
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: t.textPrimary, letterSpacing: -0.4, marginTop: 2 }}>小票</div>
          </div>
          <button onClick={() => fetchReceipts(1)}
            style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${t.border}`, background: t.surface, color: t.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Icon name="refresh" size={17} />
          </button>
        </div>

        {/* Search */}
        <div style={{ background: t.surfaceMuted, borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Icon name="search" size={16} color={t.textTertiary} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索商户名称…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: t.textPrimary, fontFamily: FONTS.ui }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: t.textTertiary, cursor: 'pointer', display: 'flex', padding: 0 }}>
              <Icon name="close" size={14} />
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 12 }}>
          {filters.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              padding: '6px 14px', borderRadius: 999, border: `1px solid ${filter === f.id ? t.brand : t.border}`,
              background: filter === f.id ? t.brand : t.surface,
              color: filter === f.id ? '#fff' : t.textSecondary,
              fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0, fontFamily: FONTS.ui,
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      <Body style={{ paddingBottom: 100 }}>
        {loading && receipts.length === 0 ? (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0,1,2].map(i => <SkeletonCard key={i} t={t} lines={2} />)}
          </div>
        ) : grouped.length === 0 ? (
          <EmptyState t={t} icon="receipt" title="暂无小票" subtitle={filter !== 'all' ? '该筛选条件下无记录' : '点击下方相机按钮上传第一张'} ctaLabel="上传小票" onCta={() => navigate('/upload')} />
        ) : (
          grouped.map(g => (
            <div key={g.label} style={{ padding: '14px 16px 0' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.textTertiary, letterSpacing: 0.3, textTransform: 'uppercase', padding: '0 4px 8px' }}>
                {g.label}
              </div>
              <Card t={t} style={{ padding: 0 }}>
                {g.items.map((r, i) => (
                  <div key={r.id} onClick={() => handleClick(r)} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer',
                    borderTop: i === 0 ? 'none' : `1px solid ${t.divider}`,
                  }}>
                    <CategoryDot name={catName(r.final_category_id ?? r.suggested_category_id)} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14.5, fontWeight: 600, color: t.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
                          {r.merchant_name ?? '未知商户'}
                        </span>
                        <Chip t={t} label={statusLabel(r.status)} tone={statusTone(r.status)} size="sm" />
                      </div>
                      <div style={{ fontSize: 12, color: t.textTertiary, marginTop: 2 }}>
                        {catName(r.final_category_id ?? r.suggested_category_id)} · {normalizeDate(r.receipt_date ?? r.created_at.slice(0,10))}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: FONTS.num, fontSize: 15, fontWeight: 700, color: t.textPrimary }}>
                        {r.total_amount != null ? nz(r.total_amount) : '—'}
                      </div>
                      <Icon name="chevR" size={14} color={t.textTertiary} />
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          ))
        )}

        {/* Load more */}
        {receipts.length < total && !loading && (
          <div style={{ padding: 20, textAlign: 'center' }}>
            <Button t={t} variant="secondary" size="sm" onClick={() => { const next = page + 1; setPage(next); fetchReceipts(next); }}>
              加载更多
            </Button>
          </div>
        )}
        {loading && receipts.length > 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: t.textTertiary, fontSize: 13 }}>加载中…</div>
        )}
      </Body>

      <TabBar t={t} current="list" onChange={s => { if (s === 'capture') navigate('/upload'); else if (s === 'home') navigate('/dashboard'); else if (s === 'report') navigate('/report'); else if (s === 'me') navigate('/settings'); }} />
    </Screen>
  );
}
