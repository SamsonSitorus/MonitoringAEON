import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Eye, 
  Layers, 
  Check, 
  Sparkles, 
  Save, 
  History, 
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { FormTemplate, FormField, FormSchema, FieldType } from '../types';

export const FormBuilderView: React.FC = () => {
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [activeVersionNumber, setActiveVersionNumber] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form Editor State
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateCode, setTemplateCode] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);

  // Interactive Live Preview State
  const [previewValues, setPreviewValues] = useState<Record<string, any>>({});

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await api.getFormTemplates();
      setTemplates(data);
      if (data.length > 0 && !selectedTemplate) {
        selectTemplate(data[0].id);
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal memuat template form', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const selectTemplate = async (templateId: string) => {
    try {
      setLoading(true);
      setIsCreatingNew(false);
      const full = await api.getFormTemplate(templateId);
      setSelectedTemplate(full);
      setTemplateName(full.name);
      setTemplateCode(full.code);
      setTemplateDesc(full.description || '');

      // Load latest version schema
      if (full.versions && full.versions.length > 0) {
        const latest = full.versions[0];
        setActiveVersionNumber(latest.version_number);
        setFields(latest.schema.fields || []);
      } else {
        setFields([]);
      }
      setPreviewValues({});
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal memuat detail template', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const startCreateNewTemplate = () => {
    setIsCreatingNew(true);
    setSelectedTemplate(null);
    setTemplateName('Form Pengecekan Baru');
    setTemplateCode('FORM-' + Math.random().toString(36).substring(2, 6).toUpperCase());
    setTemplateDesc('Deskripsi observasi form dinamis...');
    setFields([
      {
        key: 'observed_count',
        label: 'Jumlah Objek Teramati',
        type: 'number',
        required: true,
        min: 0,
        help_text: 'Masukkan angka objek',
      },
      {
        key: 'condition_status',
        label: 'Kondisi Area',
        type: 'dropdown',
        required: true,
        options: ['Normal', 'Perlu Perhatian', 'Kritis'],
      },
    ]);
    setPreviewValues({});
  };

  const addField = () => {
    const nextIdx = fields.length + 1;
    const newField: FormField = {
      key: `field_${nextIdx}`,
      label: `Field Baru #${nextIdx}`,
      type: 'number',
      required: true,
      help_text: '',
    };
    setFields([...fields, newField]);
  };

  const updateField = (index: number, updated: Partial<FormField>) => {
    const list = [...fields];
    list[index] = { ...list[index], ...updated };
    // Auto-update key slug if label changes and key is standard
    if (updated.label && list[index].key.startsWith('field_')) {
      list[index].key = updated.label.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 30);
    }
    setFields(list);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  // Save new template or publish new version
  const handleSave = async () => {
    if (!templateName || !templateCode) {
      setMessage({ text: 'Nama form dan kode wajib diisi', type: 'error' });
      return;
    }

    const schema: FormSchema = {
      name: templateName,
      description: templateDesc,
      fields: fields,
    };

    try {
      setLoading(true);
      if (isCreatingNew) {
        await api.createFormTemplate({
          name: templateName,
          code: templateCode,
          description: templateDesc,
          schema: schema,
        });
        setMessage({ text: 'Template form baru berhasil dibuat!', type: 'success' });
        await loadTemplates();
      } else if (selectedTemplate) {
        // Publish new version to preserve historical immutability
        const res = await api.createFormVersion(selectedTemplate.id, schema);
        setMessage({ text: `Versi baru (v${res.version_number}) berhasil dipublikasikan!`, type: 'success' });
        await selectTemplate(selectedTemplate.id);
        await loadTemplates();
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal menyimpan konfigurasi form', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Evaluate dynamic formula
  const computeFormula = (formula: string, values: Record<string, any>) => {
    try {
      let expression = formula;
      const matches = formula.match(/\{([^}]+)\}/g);
      if (matches) {
        for (const m of matches) {
          const key = m.replace('{', '').replace('}', '').trim();
          const val = Number(values[key]) || 0;
          expression = expression.replaceAll(m, val.toString());
        }
      }
      // Safe evaluation of basic math expressions (+, -, *, /)
      if (/^[0-9+\-*/().\s]+$/.test(expression)) {
        // eslint-disable-next-line no-eval
        return Function(`'use strict'; return (${expression})`)();
      }
      return 0;
    } catch {
      return 0;
    }
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div className="page-title-group">
          <h2>Dynamic Form Builder & Versioning Engine</h2>
          <p>Rancang form pengecekan kamera dinamis tanpa coding. Setiap perubahan tersimpan sebagai versi baru.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={startCreateNewTemplate}>
            <Plus size={16} />
            Buat Template Baru
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            <Save size={16} />
            {isCreatingNew ? 'Simpan Template Form' : `Publikasikan Versi Baru (v${activeVersionNumber + 1})`}
          </button>
        </div>
      </div>

      {message && (
        <div style={{
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          background: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
          border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
          color: message.type === 'success' ? '#34d399' : '#fb7185',
        }}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1.2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* PANEL 1: LIST TEMPLATES & VERSIONS */}
        <div className="card" style={{ padding: '1rem' }}>
          <h4 style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Daftar Template Form
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {templates.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => selectTemplate(tmpl.id)}
                style={{
                  textAlign: 'left',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  background: selectedTemplate?.id === tmpl.id && !isCreatingNew ? 'rgba(2, 132, 199, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${selectedTemplate?.id === tmpl.id && !isCreatingNew ? 'rgba(56, 189, 248, 0.3)' : 'var(--border-subtle)'}`,
                  color: selectedTemplate?.id === tmpl.id && !isCreatingNew ? 'var(--accent-cyan)' : 'var(--text-main)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{tmpl.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                    {tmpl.code} · Versi v{tmpl.latest_version || 1}
                  </div>
                </div>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>

          {selectedTemplate && selectedTemplate.versions && selectedTemplate.versions.length > 0 && (
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <History size={14} /> RIWAYAT VERSI
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {selectedTemplate.versions.map((ver) => (
                  <button
                    key={ver.id}
                    onClick={() => {
                      setActiveVersionNumber(ver.version_number);
                      setFields(ver.schema.fields || []);
                      setPreviewValues({});
                    }}
                    style={{
                      border: 'none',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: activeVersionNumber === ver.version_number ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                      color: 'white',
                    }}
                  >
                    v{ver.version_number}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* PANEL 2: FIELD EDITOR */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                {isCreatingNew ? 'Membuat Template Form Baru' : `Edit Konfigurasi (${templateName})`}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                {isCreatingNew ? 'Akan tersimpan sebagai Versi 1' : `Saat disimpan, otomatis menerbitkan Versi v${activeVersionNumber + 1}`}
              </p>
            </div>
            <button className="btn btn-secondary" onClick={addField} style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}>
              <Plus size={15} /> Tambah Field
            </button>
          </div>

          {/* Template Metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Nama Form Template</label>
              <input
                className="form-input"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Contoh: Penghitungan Orang"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Kode Template</label>
              <input
                className="form-input"
                value={templateCode}
                onChange={(e) => setTemplateCode(e.target.value.toUpperCase())}
                placeholder="FORM-PEOPLE"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Deskripsi Observasi</label>
            <input
              className="form-input"
              value={templateDesc}
              onChange={(e) => setTemplateDesc(e.target.value)}
              placeholder="Jelaskan tujuan pengecekan pada template ini..."
            />
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={16} color="#38bdf8" />
              Field Pengamatan User ({fields.length} Field)
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {fields.map((field, index) => (
                <div 
                  key={index} 
                  style={{
                    background: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.08)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
                        #{index + 1}
                      </span>
                      <strong style={{ fontSize: '0.9rem' }}>{field.label}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                        ({field.key})
                      </span>
                    </div>
                    <button
                      onClick={() => removeField(index)}
                      style={{ background: 'transparent', border: 'none', color: '#fb7185', cursor: 'pointer', padding: '4px' }}
                      title="Hapus Field"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>Label Pertanyaan / Field</label>
                      <input
                        className="form-input"
                        style={{ padding: '0.45rem 0.65rem' }}
                        value={field.label}
                        onChange={(e) => updateField(index, { label: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>Tipe Data Field</label>
                      <select
                        className="form-select"
                        style={{ padding: '0.45rem 0.65rem' }}
                        value={field.type}
                        onChange={(e) => updateField(index, { type: e.target.value as FieldType })}
                      >
                        <option value="number">Angka (Number)</option>
                        <option value="text">Teks Catatan (Text)</option>
                        <option value="dropdown">Pilihan Dropdown</option>
                        <option value="radio">Pilihan Radio (Satu)</option>
                        <option value="yes_no">Ya / Tidak (Yes/No)</option>
                        <option value="photo">Upload Foto Bukti</option>
                        <option value="formula">Formula Otomatis (Computed)</option>
                      </select>
                    </div>
                  </div>

                  {/* Options editor for Dropdown/Radio */}
                  {(field.type === 'dropdown' || field.type === 'radio') && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>
                        Pilihan Jawaban (pisahkan dengan koma)
                      </label>
                      <input
                        className="form-input"
                        style={{ padding: '0.45rem 0.65rem' }}
                        value={field.options ? field.options.join(', ') : ''}
                        onChange={(e) => updateField(index, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        placeholder="Contoh: Rendah, Sedang, Tinggi"
                      />
                    </div>
                  )}

                  {/* Formula editor */}
                  {field.type === 'formula' && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>
                        Aturan Formula (gunakan key field misal {'{male_count}'} + {'{female_count}'})
                      </label>
                      <input
                        className="form-input"
                        style={{ padding: '0.45rem 0.65rem', fontFamily: 'var(--font-mono)' }}
                        value={field.formula || ''}
                        onChange={(e) => updateField(index, { formula: e.target.value })}
                        placeholder="{male_count} + {female_count}"
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginTop: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateField(index, { required: e.target.checked })}
                      />
                      Wajib Diisi (Required)
                    </label>

                    {field.type === 'number' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                        <span>Min:</span>
                        <input
                          type="number"
                          className="form-input"
                          style={{ width: '60px', padding: '2px 6px', fontSize: '0.8rem' }}
                          value={field.min ?? 0}
                          onChange={(e) => updateField(index, { min: Number(e.target.value) })}
                        />
                      </div>
                    )}
                  </div>

                  {/* Conditional Rule (show_if) Editor */}
                  {index > 0 && (
                    <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px dashed rgba(255, 255, 255, 0.08)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--accent-cyan)', cursor: 'pointer', marginBottom: '6px' }}>
                        <input
                          type="checkbox"
                          checked={!!field.show_if}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const prevField = fields[0];
                              updateField(index, {
                                show_if: {
                                  field_key: prevField.key,
                                  operator: 'equals',
                                  value: prevField.type === 'yes_no' ? true : '',
                                },
                              });
                            } else {
                              updateField(index, { show_if: undefined });
                            }
                          }}
                        />
                        Aturan Visibilitas Dinamis (Tampilkan Hanya Jika...)
                      </label>

                      {field.show_if && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(56, 189, 248, 0.05)', padding: '6px 10px', borderRadius: '6px', fontSize: '0.78rem' }}>
                          <span>Jika field</span>
                          <select
                            className="form-select"
                            style={{ padding: '2px 6px', fontSize: '0.78rem', width: 'auto' }}
                            value={field.show_if.field_key}
                            onChange={(e) => {
                              const targetKey = e.target.value;
                              const targetField = fields.find(f => f.key === targetKey);
                              updateField(index, {
                                show_if: {
                                  field_key: targetKey,
                                  operator: 'equals',
                                  value: targetField?.type === 'yes_no' ? true : '',
                                },
                              });
                            }}
                          >
                            {fields.slice(0, index).map((pf) => (
                              <option key={pf.key} value={pf.key}>{pf.label} ({pf.key})</option>
                            ))}
                          </select>
                          <span>sama dengan</span>
                          <input
                            className="form-input"
                            style={{ padding: '2px 6px', fontSize: '0.78rem', width: '120px' }}
                            placeholder="true atau nilai"
                            value={field.show_if.value === true ? 'true' : field.show_if.value === false ? 'false' : String(field.show_if.value ?? '')}
                            onChange={(e) => {
                              let v: any = e.target.value;
                              if (v === 'true') v = true;
                              if (v === 'false') v = false;
                              updateField(index, {
                                show_if: {
                                  ...field.show_if!,
                                  value: v,
                                },
                              });
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PANEL 3: REAL-TIME INTERACTIVE PREVIEW */}
        <div className="card" style={{ position: 'sticky', top: '80px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Eye size={16} color="#10b981" />
              Preview Pengisian User
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
              Live Test
            </span>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'white' }}>{templateName || 'Form Baru'}</h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{templateDesc || 'Instruksi pengecekan'}</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {fields.map((field) => {
              // Check conditional rule
              if (field.show_if) {
                const targetVal = previewValues[field.show_if.field_key];
                if (targetVal !== field.show_if.value) {
                  return null;
                }
              }

              if (field.type === 'formula') {
                const computed = computeFormula(field.formula || '', previewValues);
                return (
                  <div key={field.key} className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">{field.label}</label>
                    <div className="formula-box">
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                        {field.formula}
                      </span>
                      <span className="formula-value">{computed}</span>
                    </div>
                  </div>
                );
              }

              return (
                <div key={field.key} className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    {field.label}
                    {field.required && <span className="required-star">*</span>}
                  </label>

                  {field.type === 'number' && (
                    <input
                      type="number"
                      className="form-input"
                      placeholder="0"
                      min={field.min}
                      value={previewValues[field.key] ?? ''}
                      onChange={(e) => setPreviewValues({ ...previewValues, [field.key]: e.target.value })}
                    />
                  )}

                  {field.type === 'text' && (
                    <input
                      type="text"
                      className="form-input"
                      placeholder={field.placeholder || 'Tuliskan catatan...'}
                      value={previewValues[field.key] ?? ''}
                      onChange={(e) => setPreviewValues({ ...previewValues, [field.key]: e.target.value })}
                    />
                  )}

                  {field.type === 'dropdown' && (
                    <select
                      className="form-select"
                      value={previewValues[field.key] ?? ''}
                      onChange={(e) => setPreviewValues({ ...previewValues, [field.key]: e.target.value })}
                    >
                      <option value="">-- Pilih opsi --</option>
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}

                  {field.type === 'yes_no' && (
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                        <input
                          type="radio"
                          name={`prev_${field.key}`}
                          checked={previewValues[field.key] === true}
                          onChange={() => setPreviewValues({ ...previewValues, [field.key]: true })}
                        />
                        Ya
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                        <input
                          type="radio"
                          name={`prev_${field.key}`}
                          checked={previewValues[field.key] === false}
                          onChange={() => setPreviewValues({ ...previewValues, [field.key]: false })}
                        />
                        Tidak
                      </label>
                    </div>
                  )}

                  {field.help_text && (
                    <span className="form-helper">{field.help_text}</span>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
              Preview JSON Output:
            </div>
            <pre style={{
              background: '#090d16',
              padding: '0.65rem',
              borderRadius: '6px',
              fontSize: '0.72rem',
              color: '#38bdf8',
              overflowX: 'auto',
              maxHeight: '120px',
            }}>
              {JSON.stringify(previewValues, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
