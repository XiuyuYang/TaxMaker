import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { api, Receipt, Category } from '../api/client';
import { useReceiptPolling } from '../hooks/useReceipts';
import { Icon } from '../components/icons';
import {
  Screen, Body, Card, Chip, Button,
  Spinner, ErrorBanner, Input, useToast, Toast, TabBar,
} from '../components/primitives';
import { FONTS } from '../tokens';

function friendlyFailureReason(reason: string | null | undefined): string {
  if (!reason) return '图片无法识别，请检查后重试';
  if (reason.includes('Unable to process input image')) return '图片无法处理，请确保图片清晰后重试';
  if (reason.includes('400') || reason.includes('API error')) return 'AI 识别服务暂时不可用，请稍后重试';
  if (reason.includes('timeout') || reason.includes('Timeout')) return '识别超时，请重试';
  if (reason.includes('quota') || reason.includes('rate limit')) return 'AI 服务繁忙，请稍后重试';
  // If it looks like a raw technical error (contains JSON or URL), show generic message
  if (reason.includes('{') || reason.includes('http') || reason.length > 100) return '图片无法识别，请检查后重试';
  return reason;
}

const GST_TREATMENTS = [
  { value: '100_claimable', label: '100% 可抵扣' },
  { value: '0_claimable', label: '不可抵扣' },
  { value: 'special_adjustment', label: '特殊调整' },
];

export default function Confirm() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTheme();
  const navigate = useNavigate();
  const { toast, show: showToast, hide: hideToast } = useToast();

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [polling, setPolling] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [reprocessing, setReprocessing] = useState(false);
  const [pollKey, setPollKey] = useState(0);

  // Form state
  const [merchantName, setMerchantName] = useState('');
  const [dateYear, setDateYear] = useState('');
  const [dateMonth, setDateMonth] = useState('');
  const [dateDay, setDateDay] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [gstAmount, setGstAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [reclassifyAll, setReclassifyAll] = useState(false);
  const [gstTreatment, setGstTreatment] = useState('100_claimable');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    api.categories.list().then(setCategories).catch(() => { });
  }, []);

  const onReady = useCallback((r: Receipt) => {
    setReceipt(r);
    setPolling(false);
    setMerchantName(r.merchant_name ?? '');
    const dp = (r.receipt_date ?? '').split('-');
    setDateYear(dp[0] ?? '');
    setDateMonth(dp[1] ?? '');
    setDateDay(dp[2] ?? '');
    setTotalAmount(r.total_amount != null ? String(r.total_amount) : '');
    setGstAmount(r.gst_amount != null ? String(r.gst_amount) : '');
    setCategoryId(r.final_category_id ?? r.suggested_category_id ?? '');
    setReclassifyAll(r.reclassify_all === 1);
    setGstTreatment(r.gst_treatment ?? '100_claimable');
    setNotes(r.notes ?? '');
  }, []);

  const onPollError = useCallback((err: Error) => {
    setPolling(false);
    const msg = err.message.toLowerCase();
    if (msg.includes('not found') || msg.includes('404')) {
      setError('小票不存在或无权访问');
    } else if (msg.includes('not authenticated') || msg.includes('401')) {
      navigate('/login');
    } else {
      setError(err.message);
    }
  }, [navigate]);

  useReceiptPolling(id ?? '', { onReady, onError: onPollError, resetKey: pollKey });

  const buildPayload = () => ({
    merchant_name: merchantName || null,
    receipt_date: (dateYear && dateMonth && dateDay) ? `${dateYear}-${dateMonth}-${dateDay}` : null,
    total_amount: totalAmount ? parseFloat(totalAmount) : null,
    gst_amount: gstAmount ? parseFloat(gstAmount) : null,
    final_category_id: categoryId || null,
    reclassify_all: reclassifyAll ? 1 : 0,
    gst_treatment: gstTreatment,
    notes: notes || null,
  });

  const handleSaveDraft = async () => {
    if (!id) return;
    setSaving(true);
    setError('');
    try {
      await api.receipts.update(id, buildPayload());
      showToast('草稿已保存', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    if (!id) return;
    setConfirming(true);
    setError('');
    try {
      await api.receipts.update(id, buildPayload());
      await api.receipts.confirm(id);
      navigate('/list', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '确认失败');
      setConfirming(false);
    }
  };

  const handleReprocess = async () => {
    if (!id) return;
    setReprocessing(true);
    setError('');
    try {
      await api.receipts.reprocess(id);
      setPolling(true);
      setPollKey(k => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : '重新识别失败');
      setReprocessing(false);
    }
  };

  // Reusable back header for early-return states
  const backHeader = (title: string) => (
    <div style={{ padding: '8px 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <button
        onClick={() => navigate('/list')}
        style={{ background: t.surfaceMuted, border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
      >
        <Icon name="chevL" size={20} color={t.textPrimary} />
      </button>
      <div style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 700, color: t.textPrimary }}>{title}</div>
    </div>
  );

  // Still polling
  if (polling) {
    return (
      <Screen t={t}>
        {backHeader('识别中')}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 32 }}>
          <div style={{
            width: 96, height: 96, borderRadius: 24, background: t.brandSoft,
            display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
          }}>
            <Icon name="receipt" size={44} color={t.brand} strokeWidth={1.5} />
            <div style={{ position: 'absolute', bottom: -6, right: -6 }}>
              <Spinner size={28} color={t.brand} />
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: t.textPrimary, marginBottom: 8 }}>AI 正在识别小票…</div>
            <div style={{ fontSize: 14, color: t.textSecondary }}>正在分析商户、金额和 GST，请稍候</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: 3, background: t.brand,
                opacity: 0.4, animation: `pulse${i} 1.2s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
              }} />
            ))}
          </div>
          <style>{`
            @keyframes pulse0 { 0%,100%{opacity:0.3} 50%{opacity:1} }
            @keyframes pulse1 { 0%,100%{opacity:0.3} 50%{opacity:1} }
            @keyframes pulse2 { 0%,100%{opacity:0.3} 50%{opacity:1} }
          `}</style>
        </div>
        <TabBar t={t} current="list" onChange={s => {
          if (s === 'home') navigate('/dashboard');
          else if (s === 'capture') navigate('/upload');
          else if (s === 'report') navigate('/report');
          else if (s === 'me') navigate('/settings');
        }} />
      </Screen>
    );
  }

  if (!receipt) {
    return (
      <Screen t={t}>
        {backHeader('小票详情')}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
          <div style={{ fontSize: 16, color: t.textSecondary }}>{error || '小票不存在或已删除'}</div>
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
  }

  if (receipt.status === 'failed') {
    return (
      <Screen t={t}>
        {backHeader('识别失败')}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32 }}>
          <div style={{ width: 80, height: 80, borderRadius: 20, background: t.dangerSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={36} color={t.danger} strokeWidth={2} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: t.textPrimary, marginBottom: 8 }}>识别失败</div>
            <div style={{ fontSize: 14, color: t.textSecondary, lineHeight: 1.6 }}>{friendlyFailureReason(receipt.failure_reason)}</div>
          </div>
          {error && <ErrorBanner t={t} message={error} />}
          <Button t={t} variant="primary" size="lg" block loading={reprocessing} onClick={handleReprocess} icon="refresh">
            重新识别
          </Button>
          <Button t={t} variant="ghost" size="md" block onClick={() => navigate('/list')}>
            返回列表
          </Button>
        </div>
        <TabBar t={t} current="list" onChange={s => {
          if (s === 'home') navigate('/dashboard');
          else if (s === 'capture') navigate('/upload');
          else if (s === 'report') navigate('/report');
          else if (s === 'me') navigate('/settings');
        }} />
      </Screen>
    );
  }

  return (
    <Screen t={t}>

      {/* Header */}
      <div style={{ padding: '8px 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => navigate('/list')}
          style={{ background: t.surfaceMuted, border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <Icon name="chevL" size={20} color={t.textPrimary} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 700, color: t.textPrimary }}>确认小票</div>
        </div>
        {receipt.ai_confidence != null && (
          <Chip t={t} label={`AI ${Math.round(receipt.ai_confidence ?? 0)}%`} tone="brand" size="sm" icon="sparkle" />
        )}
      </div>

      <Body style={{ padding: '0 16px 160px' }}>
        {error && <div style={{ marginBottom: 12 }}><ErrorBanner t={t} message={error} /></div>}

        {/* Receipt image */}
        <Card t={t} style={{ marginBottom: 12, overflow: 'hidden', borderRadius: 16 }}>
          <img
            src={api.receipts.imageUrl(receipt.id)}
            alt="小票图片"
            style={{ width: '100%', maxHeight: 220, objectFit: 'contain', display: 'block', background: t.surfaceMuted }}
          />
        </Card>

        {/* Basic info */}
        <Card t={t} style={{ padding: '16px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.textPrimary, marginBottom: 2 }}>基本信息</div>

          <Input t={t} label="商户名称" value={merchantName} onChange={setMerchantName} placeholder="输入商户名称" icon="briefcase" />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: t.textSecondary }}>日期</label>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr', gap: 8 }}>
              {/* Year */}
              <select
                value={dateYear}
                onChange={e => setDateYear(e.target.value)}
                style={{
                  width: '100%', padding: '12px 8px', background: t.surfaceAlt,
                  border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 15,
                  color: dateYear ? t.textPrimary : t.textTertiary, outline: 'none',
                  boxSizing: 'border-box', appearance: 'none', WebkitAppearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23999' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
                  paddingRight: 30,
                }}
              >
                <option value="">年</option>
                {Array.from({ length: 16 }, (_, i) => 2015 + i).map(y => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
              {/* Month */}
              <select
                value={dateMonth}
                onChange={e => setDateMonth(e.target.value)}
                style={{
                  width: '100%', padding: '12px 8px', background: t.surfaceAlt,
                  border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 15,
                  color: dateMonth ? t.textPrimary : t.textTertiary, outline: 'none',
                  boxSizing: 'border-box', appearance: 'none', WebkitAppearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23999' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
                  paddingRight: 30,
                }}
              >
                <option value="">月</option>
                {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => (
                  <option key={m} value={m}>{parseInt(m)}月</option>
                ))}
              </select>
              {/* Day */}
              <select
                value={dateDay}
                onChange={e => setDateDay(e.target.value)}
                style={{
                  width: '100%', padding: '12px 8px', background: t.surfaceAlt,
                  border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 15,
                  color: dateDay ? t.textPrimary : t.textTertiary, outline: 'none',
                  boxSizing: 'border-box', appearance: 'none', WebkitAppearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23999' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
                  paddingRight: 30,
                }}
              >
                <option value="">日</option>
                {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map(d => (
                  <option key={d} value={d}>{parseInt(d)}日</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: t.textSecondary }}>总额 (含税)</label>
              <input
                type="number"
                step="0.01"
                value={totalAmount}
                onChange={e => {
                  setTotalAmount(e.target.value);
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v)) setGstAmount((v * 3 / 23).toFixed(2));
                }}
                placeholder="0.00"
                style={{
                  width: '100%', padding: '12px 14px', background: t.surfaceAlt,
                  border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 15, color: t.textPrimary, outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: t.textSecondary }}>GST 金额</label>
              <input
                type="number"
                step="0.01"
                value={gstAmount}
                onChange={e => setGstAmount(e.target.value)}
                placeholder="0.00"
                style={{
                  width: '100%', padding: '12px 14px', background: t.surfaceAlt,
                  border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 15, color: t.textPrimary, outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        </Card>

        {/* Category */}
        <Card t={t} style={{ padding: '16px', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.textPrimary, marginBottom: 12 }}>分类</div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategoryId(cat.id)}
                style={{
                  padding: '7px 14px', borderRadius: 99, fontSize: 13, fontWeight: 500,
                  border: `1.5px solid ${categoryId === cat.id ? cat.color || t.brand : t.border}`,
                  background: categoryId === cat.id ? (cat.color || t.brand) + '18' : t.surfaceAlt,
                  color: categoryId === cat.id ? (cat.color || t.brand) : t.textSecondary,
                  cursor: 'pointer',
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Reclassify toggle */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.divider}`,
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary }}>整张小票全部归为此类</div>
              <div style={{ fontSize: 12, color: t.textTertiary, marginTop: 2 }}>包含所有条目</div>
            </div>
            <button
              onClick={() => setReclassifyAll(v => !v)}
              style={{
                width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
                background: reclassifyAll ? t.brand : t.surfaceMuted,
                position: 'relative', transition: 'background 0.2s',
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: 11, background: '#fff',
                position: 'absolute', top: 3, left: reclassifyAll ? 23 : 3,
                transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>
        </Card>

        {/* GST Treatment */}
        <Card t={t} style={{ padding: '16px', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.textPrimary, marginBottom: 12 }}>GST 处理方式</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {GST_TREATMENTS.map(option => (
              <button
                key={option.value}
                onClick={() => setGstTreatment(option.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  borderRadius: 10, border: `1.5px solid ${gstTreatment === option.value ? t.brand : t.border}`,
                  background: gstTreatment === option.value ? t.brandSoft : t.surfaceAlt,
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: 9, border: `2px solid ${gstTreatment === option.value ? t.brand : t.borderStrong}`,
                  background: gstTreatment === option.value ? t.brand : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {gstTreatment === option.value && <div style={{ width: 6, height: 6, borderRadius: 3, background: '#fff' }} />}
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color: t.textPrimary }}>{option.label}</span>
              </button>
            ))}
          </div>
          {/* Explanation when special_adjustment is selected */}
          {gstTreatment === 'special_adjustment' && (
            <div style={{
              marginTop: 10, padding: '10px 12px', borderRadius: 8,
              background: t.brandSoft, border: `1px solid ${t.brand}40`,
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <Icon name="info" size={16} color={t.brand} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 13, color: t.brand, lineHeight: 1.5 }}>
                适用于 NZ 餐饮/娱乐支出，IRD 规定仅 <strong>50%</strong> 的 GST 可抵扣。
              </div>
            </div>
          )}
        </Card>

        {/* Line items */}
        {receipt.items && receipt.items.length > 0 && (
          <Card t={t} style={{ padding: '16px', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.textPrimary, marginBottom: 12 }}>条目明细</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {receipt.items.map(item => (
                <div key={item.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', background: t.surfaceAlt, borderRadius: 8,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: t.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.description}
                    </div>
                    {item.quantity != null && (
                      <div style={{ fontSize: 11, color: t.textTertiary, marginTop: 2 }}>
                        × {item.quantity}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary, marginLeft: 12, fontFamily: FONTS.num }}>
                    {item.line_total != null ? `$${item.line_total.toFixed(2)}` : '—'}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Notes */}
        <Card t={t} style={{ padding: '16px', marginBottom: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: t.textSecondary, display: 'block', marginBottom: 8 }}>备注</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="添加备注（可选）"
            rows={3}
            style={{
              width: '100%', padding: '10px 12px', background: t.surfaceAlt,
              border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 14,
              color: t.textPrimary, resize: 'none', outline: 'none', fontFamily: FONTS.ui,
              boxSizing: 'border-box',
            }}
          />
        </Card>
      </Body>

      {/* Bottom bar (action buttons, sits above TabBar) */}
      <div style={{
        position: 'absolute', bottom: 64, left: 0, right: 0,
        padding: '12px 16px 12px', background: t.surface, borderTop: `1px solid ${t.border}`,
        display: 'flex', gap: 10,
      }}>
        <Button t={t} variant="secondary" size="md" onClick={handleSaveDraft} loading={saving} disabled={confirming}>
          保存草稿
        </Button>
        <div style={{ flex: 1 }}>
          <Button t={t} variant="primary" size="md" block onClick={handleConfirm} loading={confirming} disabled={saving} icon="check">
            确认保存
          </Button>
        </div>
      </div>

      {toast && <Toast t={t} message={toast.message} tone={toast.tone as 'success' | 'error' | 'info'} onClose={hideToast} />}

      <TabBar t={t} current="list" onChange={s => {
        if (s === 'home') navigate('/dashboard');
        else if (s === 'capture') navigate('/upload');
        else if (s === 'report') navigate('/report');
        else if (s === 'me') navigate('/settings');
      }} />
    </Screen>
  );
}
