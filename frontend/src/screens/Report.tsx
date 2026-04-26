import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { api, GSTSummary } from '../api/client';
import { Icon } from '../components/icons';
import {
  Screen, Body, Card, Button, TabBar, Spinner, nz, useToast, Toast,
} from '../components/primitives';
import { FONTS } from '../tokens';

type Period = { start: string; end: string; label: string };

function buildPeriods(): Period[] {
  const now = new Date();
  const year = now.getFullYear();
  const periods: Period[] = [];
  const pairs = [[1,2],[3,4],[5,6],[7,8],[9,10],[11,12]];
  for (let y = year; y >= year - 10; y--) {
    for (let i = pairs.length - 1; i >= 0; i--) {
      const [m1, m2] = pairs[i];
      const start = `${y}-${String(m1).padStart(2,'0')}-01`;
      const lastDay = new Date(y, m2, 0).getDate();
      const end = `${y}-${String(m2).padStart(2,'0')}-${lastDay}`;
      if (start > now.toISOString().slice(0,10)) continue;
      const label = `${y}年 ${m1}-${m2}月`;
      periods.push({ start, end, label });
    }
  }
  return periods;
}

export default function Report() {
  const { t } = useTheme();
  const navigate = useNavigate();
  const { toast, show, hide } = useToast();
  const periods = buildPeriods();
  const [selIdx, setSelIdx] = useState(0);
  const [summary, setSummary] = useState<GSTSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [box5, setBox5] = useState('');
  const [box6, setBox6] = useState('');
  const [box13, setBox13] = useState('');
  const [exporting, setExporting] = useState(false);

  const period = periods[selIdx];

  useEffect(() => {
    if (!period) return;
    setLoading(true);
    setSummary(null);
    setBox5('');
    setBox13('');
    api.reports.gstSummary(period.start, period.end)
      .then(s => {
        setSummary(s);
        setBox6(s.total_gst_claimable > 0 ? s.total_gst_claimable.toFixed(2) : '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selIdx]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const exp = await api.exports.createCsv(period.start, period.end);
      const dl = await api.exports.download(exp.export_id);
      const blob = await dl.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipts_${period.start}_${period.end}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      show('CSV 已下载', 'success');
    } catch {
      show('导出失败', 'error');
    } finally {
      setExporting(false);
    }
  };

  const box5num = parseFloat(box5) || 0;
  const box6num = parseFloat(box6) || 0;
  const box13num = parseFloat(box13) || 0;
  const suggestedBox6 = summary ? summary.total_gst_claimable : 0;
  const netGst = +(box5num - (box6num || suggestedBox6) + box13num).toFixed(2);

  const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: t.textTertiary, letterSpacing: 0.5, textTransform: 'uppercase', padding: '0 4px 8px' }}>{label}</div>
      {children}
    </div>
  );

  const GSTRow = ({ label, value, highlight }: { label: string; value: string | React.ReactNode; highlight?: boolean }) => (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '12px 16px',
      background: highlight ? t.brandSoft : 'transparent',
    }}>
      <div style={{ flex: 1, fontSize: 13, color: highlight ? t.brand : t.textPrimary, fontWeight: highlight ? 600 : 400 }}>{label}</div>
      <div style={{ fontFamily: FONTS.num, fontSize: 14, fontWeight: highlight ? 700 : 500, color: highlight ? t.brand : t.textPrimary }}>{value}</div>
    </div>
  );

  return (
    <Screen t={t}>

      {/* Header */}
      <div style={{ padding: '16px 16px 12px', background: t.surface, borderBottom: `1px solid ${t.border}` }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: t.textPrimary, letterSpacing: -0.4 }}>GST 报表</div>
        <div style={{ fontSize: 12, color: t.textTertiary, marginTop: 2 }}>GST 101A 双月申报</div>
      </div>

      <Body style={{ paddingBottom: 100 }}>
        <div style={{ padding: 16 }}>

          {/* Period selector */}
          <Section label="申报期间">
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
              {periods.map((p, i) => (
                <button key={p.start} onClick={() => setSelIdx(i)} style={{
                  padding: '6px 14px', borderRadius: 999, border: `1px solid ${selIdx === i ? t.brand : t.border}`,
                  background: selIdx === i ? t.brand : t.surface,
                  color: selIdx === i ? '#fff' : t.textSecondary,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0, fontFamily: FONTS.ui,
                }}>{p.label}</button>
              ))}
            </div>
          </Section>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Spinner size={28} color={t.brand} />
            </div>
          ) : (
            <>
              {/* Stats row */}
              {summary && (
                <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                  {[
                    { label: '小票数', value: String(summary.receipt_count) },
                    { label: '采购总额', value: nz(summary.box_12) },
                    { label: '可抵扣GST', value: nz(summary.total_gst_claimable) },
                  ].map(s => (
                    <Card key={s.label} t={t} style={{ flex: 1, padding: '12px 10px', textAlign: 'center' }}>
                      <div style={{ fontFamily: FONTS.num, fontSize: 16, fontWeight: 700, color: t.textPrimary }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: t.textTertiary, marginTop: 3 }}>{s.label}</div>
                    </Card>
                  ))}
                </div>
              )}

              {/* GST 101A form */}
              <Section label="GST 汇算">
                <Card t={t} style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ borderBottom: `1px solid ${t.divider}` }}>
                    <GSTRow label="应税销售总额（含GST）" value={summary ? nz(summary.box_11) : '—'} />
                  </div>
                  <div style={{ borderBottom: `1px solid ${t.divider}` }}>
                    <GSTRow label="应税采购总额（含GST）" value={summary ? nz(summary.box_12) : '—'} />
                  </div>
                  <div style={{ borderBottom: `1px solid ${t.divider}` }}>
                    <GSTRow label="销售收取的GST" value={
                      <input value={box5} onChange={e => setBox5(e.target.value)} placeholder="0.00"
                        style={{ width: 90, textAlign: 'right', fontFamily: FONTS.num, fontSize: 14, background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 6, padding: '3px 6px', color: t.textPrimary, outline: 'none' }} />
                    } />
                  </div>
                  <div style={{ borderBottom: `1px solid ${t.divider}` }}>
                    <GSTRow label="采购可抵扣GST" value={
                      <input value={box6} onChange={e => setBox6(e.target.value)} placeholder={summary ? suggestedBox6.toFixed(2) : '0.00'}
                        style={{ width: 90, textAlign: 'right', fontFamily: FONTS.num, fontSize: 14, background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 6, padding: '3px 6px', color: t.textPrimary, outline: 'none' }} />
                    } />
                  </div>
                  <div style={{ borderBottom: `1px solid ${t.divider}` }}>
                    <GSTRow label="GST 调整额（私用比例等）" value={
                      <input value={box13} onChange={e => setBox13(e.target.value)} placeholder="0.00"
                        inputMode="decimal"
                        style={{ width: 90, textAlign: 'right', fontFamily: FONTS.num, fontSize: 14, background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 6, padding: '3px 6px', color: t.textPrimary, outline: 'none' }} />
                    } />
                  </div>
                  <GSTRow label="应缴 / 退还 GST" value={summary ? (netGst >= 0 ? `应缴 ${nz(netGst)}` : `退还 ${nz(-netGst)}`) : '—'} highlight />
                </Card>
                <div style={{ fontSize: 11, color: t.textTertiary, padding: '8px 4px', lineHeight: 1.5 }}>
                  销售GST、调整额由你手动填写；采购GST已由AI自动估算。<br />
                  调整额用于私用比例修正、坏账冲回等，正数为应补缴，负数为应退还。仅供参考，请以IRD官方申报为准。
                </div>
              </Section>

              {/* Export */}
              <Section label="导出">
                <Button t={t} variant="primary" size="md" disabled={exporting} onClick={handleExport}
                  style={{ width: '100%' }}>
                  <Icon name="download" size={16} />
                  {exporting ? '导出中…' : '下载 CSV'}
                </Button>
              </Section>
            </>
          )}
        </div>
      </Body>

      <TabBar t={t} current="report" onChange={s => {
        if (s === 'capture') navigate('/upload');
        else if (s === 'home') navigate('/dashboard');
        else if (s === 'list') navigate('/list');
        else if (s === 'me') navigate('/settings');
      }} />

      {toast && <Toast t={t} message={toast.message} tone={toast.tone} onClose={hide} />}
    </Screen>
  );
}
