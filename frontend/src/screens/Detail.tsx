import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { api, Receipt, Category } from '../api/client';
import { Icon } from '../components/icons';
import {
  Screen, Body, Card, Chip, Button, Spinner, nz, TabBar,
} from '../components/primitives';
import { FONTS } from '../tokens';

function statusLabel(s: Receipt['status']) {
  const m: Record<string, string> = {
    uploaded: '已上传', processing: '识别中', needs_review: '待确认', confirmed: '已确认', failed: '失败',
  };
  return m[s] ?? s;
}
function statusTone(s: Receipt['status']): 'brand' | 'success' | 'danger' | 'warn' | 'default' {
  if (s === 'confirmed') return 'success';
  if (s === 'needs_review') return 'warn';
  if (s === 'failed') return 'danger';
  if (s === 'processing' || s === 'uploaded') return 'brand';
  return 'default';
}

type Tab = 'info' | 'photo' | 'history';

export default function Detail() {
  const { t } = useTheme();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('info');
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.receipts.get(id),
      api.categories.list(),
    ]).then(([r, cats]) => {
      setReceipt(r);
      setCategories(cats);
    }).catch(() => navigate('/list')).finally(() => setLoading(false));
  }, [id, navigate]);

  const catName = (cid: string | null) =>
    cid ? (categories.find(c => c.id === cid)?.name ?? '未分类') : '未分类';

  if (loading) return (
    <Screen t={t}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size={32} color={t.brand} />
      </div>
      <TabBar t={t} current="list" onChange={s => {
        if (s === 'home') navigate('/dashboard');
        else if (s === 'capture') navigate('/upload');
        else if (s === 'report') navigate('/report');
        else if (s === 'me') navigate('/settings');
      }} />
    </Screen>
  );

  if (!receipt) return (
    <Screen t={t}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
        <div style={{ fontSize: 16, color: t.textSecondary }}>小票不存在或已删除</div>
        <Button t={t} variant="primary" size="md" onClick={() => navigate('/list')}>返回列表</Button>
      </div>
      <TabBar t={t} current="list" onChange={s => {
        if (s === 'home') navigate('/dashboard');
        else if (s === 'capture') navigate('/upload');
        else if (s === 'report') navigate('/report');
        else if (s === 'me') navigate('/settings');
      }} />
    </Screen>
  );

  const categoryName = catName(receipt.final_category_id ?? receipt.suggested_category_id);
  const gstAmount = receipt.gst_amount != null ? receipt.gst_amount
    : receipt.total_amount != null ? +(receipt.total_amount * 15 / 115).toFixed(2) : null;

  const rows: Array<{ label: string; value: string | null }> = [
    { label: '商户', value: receipt.merchant_name ?? '—' },
    { label: '日期', value: (receipt.receipt_date ?? receipt.created_at.slice(0, 10)).replace(/\//g, '-').slice(0, 10) },
    { label: '金额', value: receipt.total_amount != null ? nz(receipt.total_amount) : '—' },
    { label: 'GST', value: gstAmount != null ? nz(gstAmount) : '—' },
    { label: '类别', value: categoryName },
    { label: '备注', value: receipt.notes || '—' },
  ];

  return (
    <Screen t={t}>

      {/* Header */}
      <div style={{ padding: '16px 16px 0', background: t.surface, borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={() => navigate('/list')} style={{
            width: 36, height: 36, borderRadius: 10, border: `1px solid ${t.border}`,
            background: t.surface, color: t.textSecondary, display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <Icon name="chevL" size={17} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: t.textPrimary }}>
              {receipt.merchant_name ?? '小票详情'}
            </div>
            <div style={{ fontSize: 12, color: t.textTertiary, marginTop: 2 }}>
              {(receipt.receipt_date ?? receipt.created_at.slice(0, 10)).replace(/\//g, '-').slice(0, 10)}
            </div>
          </div>
          <Chip t={t} label={statusLabel(receipt.status)} tone={statusTone(receipt.status)} size="sm" />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${t.border}`, marginBottom: -1 }}>
          {(['info', 'photo', 'history'] as Tab[]).map(tb => {
            const labels: Record<Tab, string> = { info: '详情', photo: '图片', history: '历史' };
            return (
              <button key={tb} onClick={() => setTab(tb)} style={{
                flex: 1, padding: '10px 0', background: 'none', border: 'none',
                borderBottom: `2px solid ${tab === tb ? t.brand : 'transparent'}`,
                color: tab === tb ? t.brand : t.textSecondary,
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONTS.ui,
              }}>{labels[tb]}</button>
            );
          })}
        </div>
      </div>

      <Body style={{ paddingBottom: 80 }}>
        {tab === 'info' && (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Amount hero */}
            <div style={{ textAlign: 'center', padding: '24px 0 16px' }}>
              <div style={{ fontFamily: FONTS.num, fontSize: 40, fontWeight: 700, color: t.textPrimary }}>
                {receipt.total_amount != null ? nz(receipt.total_amount) : '—'}
              </div>
              <div style={{ fontSize: 13, color: t.textTertiary, marginTop: 4 }}>含GST {gstAmount != null ? nz(gstAmount) : '—'}</div>
            </div>

            <Card t={t} style={{ padding: 0 }}>
              {rows.map((row, i) => (
                <div key={row.label} style={{
                  display: 'flex', alignItems: 'center', padding: '13px 16px',
                  borderTop: i === 0 ? 'none' : `1px solid ${t.divider}`,
                }}>
                  <div style={{ width: 72, fontSize: 13, color: t.textTertiary, flexShrink: 0 }}>{row.label}</div>
                  <div style={{ flex: 1, fontSize: 14, color: t.textPrimary, fontWeight: 500 }}>{row.value}</div>
                </div>
              ))}
            </Card>

            {receipt.items && receipt.items.length > 0 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.textTertiary, letterSpacing: 0.3, textTransform: 'uppercase', padding: '4px 4px 0' }}>明细</div>
                <Card t={t} style={{ padding: 0 }}>
                  {receipt.items.map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', padding: '11px 16px',
                      borderTop: i === 0 ? 'none' : `1px solid ${t.divider}`,
                    }}>
                      <div style={{ flex: 1, fontSize: 13, color: t.textPrimary }}>{item.description}</div>
                      <div style={{ fontFamily: FONTS.num, fontSize: 13, color: t.textSecondary }}>
                        {item.quantity != null && item.quantity !== 1 ? `×${item.quantity} ` : ''}
                        {nz(item.line_total)}
                      </div>
                    </div>
                  ))}
                </Card>
              </>
            )}

            <Button t={t} variant="secondary" size="md"
              onClick={() => navigate(`/confirm/${receipt.id}`)}>
              编辑此小票
            </Button>
          </div>
        )}

        {tab === 'photo' && (
          <div style={{ padding: 16 }}>
            {imgError ? (
              <div style={{
                background: t.surfaceMuted, borderRadius: 12, padding: '60px 24px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              }}>
                <Icon name="image" size={44} color={t.textTertiary} />
                <div style={{ fontSize: 15, fontWeight: 600, color: t.textSecondary }}>图片不可用</div>
                <div style={{ fontSize: 12, color: t.textTertiary, textAlign: 'center', maxWidth: 240 }}>
                  此小票可能未上传图片，或图片已被移除
                </div>
              </div>
            ) : (
              <img
                src={api.receipts.imageUrl(receipt.id)}
                alt="receipt"
                onError={() => setImgError(true)}
                style={{ width: '100%', borderRadius: 12, display: 'block', background: t.surfaceMuted }}
              />
            )}
          </div>
        )}

        {tab === 'history' && (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card t={t} style={{ padding: 0 }}>
              {[
                { label: '上传时间', value: receipt.created_at.slice(0, 16).replace('T', ' ') },
                { label: '最后更新', value: receipt.updated_at.slice(0, 16).replace('T', ' ') },
                { label: '状态', value: statusLabel(receipt.status) },
              ].map((row, i) => (
                <div key={row.label} style={{
                  display: 'flex', padding: '13px 16px',
                  borderTop: i === 0 ? 'none' : `1px solid ${t.divider}`,
                }}>
                  <div style={{ width: 80, fontSize: 13, color: t.textTertiary, flexShrink: 0 }}>{row.label}</div>
                  <div style={{ flex: 1, fontSize: 13, color: t.textPrimary }}>{row.value}</div>
                </div>
              ))}
            </Card>
          </div>
        )}
      </Body>

      <TabBar t={t} current="list" onChange={s => {
        if (s === 'home') navigate('/dashboard');
        else if (s === 'capture') navigate('/upload');
        else if (s === 'report') navigate('/report');
        else if (s === 'me') navigate('/settings');
      }} />
    </Screen>
  );
}
