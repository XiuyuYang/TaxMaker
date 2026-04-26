import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { api, Category } from '../api/client';
import { Icon } from '../components/icons';
import {
  Screen, Body, Card, Button, Spinner, CategoryDot, useToast, Toast, TabBar,
} from '../components/primitives';
import { FONTS } from '../tokens';

export default function Categories() {
  const { t } = useTheme();
  const navigate = useNavigate();
  const { toast, show, hide } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMode, setNewMode] = useState<string>('claimable');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editMode, setEditMode] = useState<string>('claimable');

  const MODE_LABELS: Record<string, string> = {
    claimable: '可抵扣',
    non_claimable: '不可抵扣',
    mixed: '混合',
    special_adjustment: '特殊调整',
  };
  const MODE_TONES: Record<string, { bg: string; fg: string }> = {
    claimable:          { bg: '#10B98118', fg: '#059669' },
    non_claimable:      { bg: '#EF444418', fg: '#DC2626' },
    mixed:              { bg: '#8B5CF618', fg: '#7C3AED' },
    special_adjustment: { bg: '#F59E0B18', fg: '#D97706' },
  };
  const ModeBadge = ({ mode }: { mode: string }) => {
    const tone = MODE_TONES[mode] ?? MODE_TONES.claimable;
    return (
      <div style={{
        fontSize: 11, fontWeight: 600, color: tone.fg, background: tone.bg,
        padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap',
      }}>{MODE_LABELS[mode] ?? mode}</div>
    );
  };

  const load = () => {
    api.categories.list().then(setCategories).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const system = categories.filter(c => !c.user_id);
  const custom = categories.filter(c => !!c.user_id);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await api.categories.create({ name: newName.trim(), gst_claim_mode: newMode });
      setNewName('');
      setNewMode('claimable');
      setAdding(false);
      load();
      show('类别已创建', 'success');
    } catch {
      show('创建失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (id: string) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await api.categories.update(id, { name: editName.trim(), gst_claim_mode: editMode });
      setEditId(null);
      setEditName('');
      load();
      show('已更新', 'success');
    } catch {
      show('更新失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`删除类别"${name}"？\n如果该类别已被小票引用，将自动停用而非永久删除。`)) return;
    try {
      const res = await api.categories.delete(id);
      load();
      if (res.deleted) {
        show('类别已删除', 'success');
      } else {
        show('类别已停用（仍被历史小票引用，保留以维持记录完整）', 'info');
      }
    } catch {
      show('删除失败', 'error');
    }
  };

  const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ padding: '14px 16px 0' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: t.textTertiary, letterSpacing: 0.5, textTransform: 'uppercase', padding: '0 4px 8px' }}>{label}</div>
      {children}
    </div>
  );

  return (
    <Screen t={t}>

      {/* Header */}
      <div style={{ padding: '16px 16px 12px', background: t.surface, borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate('/settings')} style={{
          width: 36, height: 36, borderRadius: 10, border: `1px solid ${t.border}`,
          background: t.surface, color: t.textSecondary, display: 'flex',
          alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <Icon name="chevL" size={17} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.textPrimary }}>类别管理</div>
        </div>
        <button onClick={() => { setAdding(true); setEditId(null); }} style={{
          width: 36, height: 36, borderRadius: 10, border: `1px solid ${t.border}`,
          background: t.surface, color: t.brand, display: 'flex',
          alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <Icon name="plus" size={18} />
        </button>
      </div>

      <Body style={{ paddingBottom: 80 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Spinner size={28} color={t.brand} />
          </div>
        ) : (
          <>
            {adding && (
              <div style={{ padding: '14px 16px 0' }}>
                <Card t={t} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus
                      placeholder="新类别名称"
                      onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
                      style={{ flex: 1, fontSize: 14, background: t.surfaceMuted, border: `1px solid ${t.border}`, borderRadius: 8, padding: '8px 12px', color: t.textPrimary, fontFamily: FONTS.ui, outline: 'none' }} />
                    <button onClick={() => setAdding(false)} style={{ background: 'none', border: 'none', color: t.textTertiary, cursor: 'pointer', display: 'flex', padding: 4 }}>
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <select value={newMode} onChange={e => setNewMode(e.target.value)}
                      style={{ flex: 1, fontSize: 13, background: t.surfaceMuted, border: `1px solid ${t.border}`, borderRadius: 8, padding: '7px 10px', color: t.textPrimary, fontFamily: FONTS.ui, outline: 'none' }}>
                      <option value="claimable">可抵扣 GST</option>
                      <option value="non_claimable">不可抵扣 GST</option>
                      <option value="mixed">混合 (50%)</option>
                      <option value="special_adjustment">特殊调整 (50%)</option>
                    </select>
                    <Button t={t} variant="primary" size="sm" disabled={saving || !newName.trim()} onClick={handleAdd}>
                      {saving ? '…' : '添加'}
                    </Button>
                  </div>
                </Card>
              </div>
            )}

            <Section label={`自定义类别 (${custom.length})`}>
              {custom.length === 0 && !adding ? (
                <Card t={t} style={{ padding: 20, textAlign: 'center', color: t.textTertiary, fontSize: 13 }}>
                  暂无自定义类别，点击右上角 + 添加
                </Card>
              ) : (
                <Card t={t} style={{ padding: 0 }}>
                  {custom.map((c, i) => (
                    <div key={c.id} style={{
                      borderTop: i === 0 ? 'none' : `1px solid ${t.divider}`,
                      padding: editId === c.id ? '12px 16px' : '12px 16px',
                    }}>
                      {editId === c.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <CategoryDot name={editName || c.name} size={36} />
                            <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') handleEdit(c.id); if (e.key === 'Escape') setEditId(null); }}
                              style={{ flex: 1, fontSize: 14, background: 'transparent', border: `1px solid ${t.brand}`, borderRadius: 6, padding: '6px 10px', color: t.textPrimary, fontFamily: FONTS.ui, outline: 'none' }} />
                            <button onClick={() => handleEdit(c.id)} style={{ background: 'none', border: 'none', color: t.brand, cursor: 'pointer', display: 'flex', padding: 4 }}>
                              <Icon name="check" size={16} />
                            </button>
                            <button onClick={() => setEditId(null)} style={{ background: 'none', border: 'none', color: t.textTertiary, cursor: 'pointer', display: 'flex', padding: 4 }}>
                              <Icon name="close" size={16} />
                            </button>
                          </div>
                          <select value={editMode} onChange={e => setEditMode(e.target.value)}
                            style={{ width: '100%', fontSize: 13, background: t.surfaceMuted, border: `1px solid ${t.border}`, borderRadius: 8, padding: '7px 10px', color: t.textPrimary, fontFamily: FONTS.ui, outline: 'none' }}>
                            <option value="claimable">可抵扣 GST</option>
                            <option value="non_claimable">不可抵扣 GST</option>
                            <option value="mixed">混合</option>
                            <option value="special_adjustment">特殊调整 (50%)</option>
                          </select>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <CategoryDot name={c.name} size={36} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 500, color: t.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                            <div style={{ marginTop: 4 }}><ModeBadge mode={c.gst_claim_mode} /></div>
                          </div>
                          <button onClick={() => { setEditId(c.id); setEditName(c.name); setEditMode(c.gst_claim_mode || 'claimable'); setAdding(false); }}
                            style={{ background: 'none', border: 'none', color: t.textTertiary, cursor: 'pointer', display: 'flex', padding: 4 }}>
                            <Icon name="edit" size={15} />
                          </button>
                          <button onClick={() => handleDelete(c.id, c.name)}
                            style={{ background: 'none', border: 'none', color: '#D94F4F', cursor: 'pointer', display: 'flex', padding: 4 }}>
                            <Icon name="close" size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </Card>
              )}
            </Section>

            <Section label={`系统类别 (${system.length})`}>
              <Card t={t} style={{ padding: 0 }}>
                {system.map((c, i) => (
                  <div key={c.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    borderTop: i === 0 ? 'none' : `1px solid ${t.divider}`,
                  }}>
                    <CategoryDot name={c.name} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: t.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                      <div style={{ marginTop: 4 }}><ModeBadge mode={c.gst_claim_mode} /></div>
                    </div>
                    <div style={{ fontSize: 11, color: t.textTertiary, background: t.surfaceMuted, padding: '2px 8px', borderRadius: 999, flexShrink: 0 }}>系统</div>
                  </div>
                ))}
              </Card>
            </Section>
          </>
        )}
      </Body>

      {toast && <Toast t={t} message={toast.message} tone={toast.tone} onClose={hide} />}

      <TabBar t={t} current="me" onChange={s => {
        if (s === 'home') navigate('/dashboard');
        else if (s === 'list') navigate('/list');
        else if (s === 'capture') navigate('/upload');
        else if (s === 'report') navigate('/report');
        else if (s === 'me') navigate('/settings');
      }} />
    </Screen>
  );
}
