import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, 
  RefreshCw, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  MessageSquare, 
  Image as ImageIcon,
  Check,
  Calendar,
  CalendarDays,
  FileSpreadsheet,
  FileCode,
  FileText,
  X,
  Filter,
  ShieldCheck
} from 'lucide-react';
import { api } from '../services/api';
import { InspectionRecord } from '../types';
import { Pagination } from './Pagination';
import { AuditTrailView } from './AuditTrailView';

type DatePreset = 'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM';

export const ReportsView: React.FC = () => {
  const [records, setRecords] = useState<InspectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [reviewFilter, setReviewFilter] = useState('ALL');
  const [datePreset, setDatePreset] = useState<DatePreset>('ALL');
  const [customDate, setCustomDate] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Tab selector: Inspections vs Full Audit Trail
  const [activeReportTab, setActiveReportTab] = useState<'inspections' | 'audit_trail'>('inspections');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Export dropdown state
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadRecords();
  }, []);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const data = await api.getRecords();
      setRecords(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const formatKeyName = (key: string) => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  // Date Range Helper for This Week
  const getWeekRange = () => {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return { monday, sunday };
  };

  const getRecordDate = (r: InspectionRecord): { str: string; date: Date } => {
    if (r.submitted_at) {
      const d = new Date(r.submitted_at);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return { str: `${y}-${m}-${day}`, date: d };
      }
    }
    if (r.target_date) {
      const d = new Date(r.target_date);
      return { str: r.target_date, date: d };
    }
    return { str: '', date: new Date() };
  };

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const { monday, sunday } = getWeekRange();

  // Filtered Records
  const filtered = records.filter((r) => {
    const { str: recordDateStr, date: recordDate } = getRecordDate(r);

    // Date Preset Filter
    if (datePreset === 'TODAY') {
      if (recordDateStr !== todayStr) return false;
    } else if (datePreset === 'THIS_WEEK') {
      if (recordDate < monday || recordDate > sunday) return false;
    } else if (datePreset === 'THIS_MONTH') {
      if (!recordDateStr.startsWith(currentMonthPrefix)) return false;
    } else if (datePreset === 'CUSTOM') {
      if (customDate && recordDateStr !== customDate) return false;
    }

    // Review Status Filter
    if (reviewFilter !== 'ALL' && r.review_status !== reviewFilter) {
      return false;
    }

    // Search Filter
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchCam = r.camera_name?.toLowerCase().includes(q) || r.camera_code?.toLowerCase().includes(q);
      const matchInsp = r.inspector_name?.toLowerCase().includes(q);
      const matchTmpl = r.template_name?.toLowerCase().includes(q);
      const matchSlot = String(r.payload?.observation_time_slot || '').toLowerCase().includes(q);
      const matchSys = r.camera_system?.toLowerCase().includes(q);
      const matchNvr = r.camera_nvr?.toLowerCase().includes(q);
      if (!matchCam && !matchInsp && !matchTmpl && !matchSlot && !matchSys && !matchNvr) return false;
    }

    return true;
  });

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [datePreset, customDate, search, reviewFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedRecords = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const isFiltering = datePreset !== 'ALL' || customDate !== '' || search.trim() !== '' || reviewFilter !== 'ALL';

  const resetFilters = () => {
    setDatePreset('ALL');
    setCustomDate('');
    setSearch('');
    setReviewFilter('ALL');
    setCurrentPage(1);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(paginatedRecords.map((r) => r.id)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  // ==========================================
  // EXPORT / DOWNLOAD HANDLERS (Excel, JSON, CSV)
  // ==========================================

  // 1. EXCEL EXPORT (.xls Spreadsheet with formatting)
  const handleDownloadExcel = (dataToExport: InspectionRecord[]) => {
    const rows = dataToExport.map((r, idx) => {
      const payloadStr = Object.entries(r.payload || {})
        .map(([k, v]) => `${formatKeyName(k)}: ${typeof v === 'boolean' ? (v ? 'Ya' : 'Tidak') : v}`)
        .join('; ');
      return `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td style="font-family: monospace;">${r.id}</td>
          <td>${r.submitted_at ? new Date(r.submitted_at).toLocaleString('id-ID') : '-'}</td>
          <td style="font-weight: bold;">${r.camera_system || 'InaAI'}</td>
          <td>${r.camera_nvr || '-'}</td>
          <td>${r.camera_code || '-'}</td>
          <td style="font-weight: bold;">${r.camera_name || '-'}</td>
          <td>Ch. ${r.camera_channel_no || 1}</td>
          <td>${r.inspector_name || '-'}</td>
          <td>${r.target_date || '-'}</td>
          <td>${r.template_name || '-'} (v${r.version_number || 1})</td>
          <td style="color: #4338ca; font-weight: bold;">${r.payload?.observation_time_slot || '-'}</td>
          <td>${payloadStr}</td>
          <td>${r.notes || '-'}</td>
          <td style="font-weight: bold;">${r.review_status}</td>
          <td>${r.review_notes || '-'}</td>
        </tr>
      `;
    }).join('');

    const tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Laporan Audit Inspeksi</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        <style>
          body { font-family: Calibri, sans-serif; }
          th { background-color: #0284c7; color: #ffffff; font-weight: bold; border: 1px solid #94a3b8; text-align: left; padding: 8px 12px; }
          td { border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 10pt; }
        </style>
      </head>
      <body>
        <h2>LAPORAN PENGECEKAN & JEJAK AUDIT KAMERA (MONITORINGION)</h2>
        <p>Tanggal Ekspor: ${new Date().toLocaleString('id-ID')} | Total Data Diekspor: ${dataToExport.length}</p>
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>ID Audit</th>
              <th>Waktu Submit</th>
              <th>Sistem Kamera</th>
              <th>NVR / Host</th>
              <th>Kode Kamera</th>
              <th>Nama Kamera</th>
              <th>Channel</th>
              <th>Petugas (Inspector)</th>
              <th>Tanggal Target</th>
              <th>Template Form</th>
              <th>Slot Waktu Pengamatan</th>
              <th>Rincian Hasil Observasi</th>
              <th>Catatan Petugas</th>
              <th>Status Review</th>
              <th>Catatan Supervisor</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_Audit_Kamera_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 2. JSON EXPORT (.json file)
  const handleDownloadJSON = (dataToExport: InspectionRecord[]) => {
    const jsonStr = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_Audit_Kamera_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 3. CSV EXPORT (.csv file with BOM for UTF-8)
  const handleDownloadCSV = (dataToExport: InspectionRecord[]) => {
    const headers = [
      'No',
      'ID Audit',
      'Waktu Submit',
      'Sistem Kamera',
      'NVR',
      'Kode Kamera',
      'Nama Kamera',
      'Channel',
      'Petugas',
      'Tanggal Target',
      'Template Form',
      'Slot Waktu',
      'Rincian Observasi',
      'Catatan Petugas',
      'Status Review',
      'Catatan Supervisor'
    ];

    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '""';
      const s = String(val).replace(/"/g, '""');
      return `"${s}"`;
    };

    const csvRows = [
      headers.map(escapeCSV).join(','),
      ...dataToExport.map((r, idx) => {
        const payloadStr = Object.entries(r.payload || {})
          .map(([k, v]) => `${k}: ${v}`)
          .join('; ');
        return [
          idx + 1,
          r.id,
          r.submitted_at || '',
          r.camera_system || 'InaAI',
          r.camera_nvr || '',
          r.camera_code || '',
          r.camera_name || '',
          r.camera_channel_no ? `Ch ${r.camera_channel_no}` : 'Ch 1',
          r.inspector_name || '',
          r.target_date || '',
          `${r.template_name || ''} v${r.version_number || 1}`,
          r.payload?.observation_time_slot || '',
          payloadStr,
          r.notes || '',
          r.review_status || '',
          r.review_notes || ''
        ].map(escapeCSV).join(',');
      })
    ];

    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_Audit_Kamera_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div className="page-title-group">
          <h2>{activeReportTab === 'inspections' ? 'Laporan Pengecekan Observasi Kamera' : 'Jejak Audit Aktivitas Sistem (Audit Trail)'}</h2>
          <p>
            {activeReportTab === 'inspections' 
              ? 'Rekapitulasi seluruh riwayat observasi kamera, versi form yang digunakan, dan rincian data hasil pengerjaan.'
              : 'Pencatatan jejak audit komprehensif seluruh aktivitas sistem: Login, Master Kamera, Penugasan Jadwal, Inspeksi, Review Supervisor, Manajemen Pengguna, dan Template Form.'}
          </p>
        </div>
        {activeReportTab === 'inspections' && (
          <div className="header-actions">
            <button className="btn btn-secondary" onClick={loadRecords}>
              <RefreshCw size={16} /> Perbarui
            </button>

            {/* MULTI-FORMAT DOWNLOAD DROPDOWN */}
            <div style={{ position: 'relative' }} ref={exportMenuRef}>
              <button 
                className="btn btn-primary" 
                onClick={() => setShowExportMenu(!showExportMenu)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Download size={16} /> Unduh Laporan <ChevronDown size={14} />
              </button>

            {showExportMenu && (
              <div 
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 6px)',
                  zIndex: 50,
                  background: '#0d1527',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '10px',
                  boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.8), 0 0 15px rgba(56, 189, 248, 0.15)',
                  minWidth: '240px',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ padding: '6px 10px', fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Pilih Format ({filtered.length} Data)
                </div>

                {/* Option 1: Excel */}
                <button
                  type="button"
                  onClick={() => { handleDownloadExcel(filtered); setShowExportMenu(false); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(16, 185, 129, 0.12)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileSpreadsheet size={18} color="#10b981" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>Excel Spreadsheet (.xls)</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Format tabel rapi & siap cetak</div>
                  </div>
                </button>

                {/* Option 2: CSV */}
                <button
                  type="button"
                  onClick={() => { handleDownloadCSV(filtered); setShowExportMenu(false); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(56, 189, 248, 0.12)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={18} color="#38bdf8" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>CSV File (.csv)</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Standar koma universal</div>
                  </div>
                </button>

                {/* Option 3: JSON */}
                <button
                  type="button"
                  onClick={() => { handleDownloadJSON(filtered); setShowExportMenu(false); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(245, 158, 11, 0.12)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileCode size={18} color="#f59e0b" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>JSON Raw (.json)</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Payload data terstruktur</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* TOP NAVIGATION TABS */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setActiveReportTab('inspections')}
          style={{
            background: activeReportTab === 'inspections' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
            border: `1px solid ${activeReportTab === 'inspections' ? '#0ea5e9' : 'transparent'}`,
            color: activeReportTab === 'inspections' ? '#ffffff' : 'var(--text-muted)',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <FileSpreadsheet size={16} color={activeReportTab === 'inspections' ? '#38bdf8' : 'var(--text-dim)'} />
          Laporan Observasi Kamera ({records.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveReportTab('audit_trail')}
          style={{
            background: activeReportTab === 'audit_trail' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
            border: `1px solid ${activeReportTab === 'audit_trail' ? '#8b5cf6' : 'transparent'}`,
            color: activeReportTab === 'audit_trail' ? '#ffffff' : 'var(--text-muted)',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <ShieldCheck size={16} color={activeReportTab === 'audit_trail' ? '#c084fc' : 'var(--text-dim)'} />
          Jejak Audit Aktivitas Sistem (Semua Fitur)
        </button>
      </div>

      {activeReportTab === 'audit_trail' ? (
        <AuditTrailView />
      ) : (
        <>

      {/* FILTER & DATE PRESETS CARD */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {/* Top Row: Date Presets & Custom Picker & Expand Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', marginRight: '4px' }}>
              <CalendarDays size={14} color="#38bdf8" /> Periode:
            </span>
            {(['ALL', 'TODAY', 'THIS_WEEK', 'THIS_MONTH', 'CUSTOM'] as const).map((preset) => {
              const labels: Record<string, string> = {
                ALL: 'Semua Waktu',
                TODAY: 'Hari Ini',
                THIS_WEEK: 'Minggu Ini',
                THIS_MONTH: 'Bulan Ini',
                CUSTOM: 'Pilih Tanggal'
              };
              const isActive = datePreset === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setDatePreset(preset);
                    if (preset !== 'CUSTOM') setCustomDate('');
                  }}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: isActive ? '1px solid #0284c7' : '1px solid var(--border-subtle)',
                    background: isActive ? 'rgba(2, 132, 199, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                    color: isActive ? '#38bdf8' : 'var(--text-dim)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {labels[preset]}
                </button>
              );
            })}

            {datePreset === 'CUSTOM' && (
              <input
                type="date"
                className="form-input"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem', width: '145px', borderColor: '#38bdf8' }}
              />
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}
              onClick={expandAll}
            >
              <ChevronDown size={13} /> Buka Semua Halaman Ini
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}
              onClick={collapseAll}
            >
              <ChevronUp size={13} /> Tutup Semua
            </button>
          </div>
        </div>

        {/* Bottom Row: Search, Review Status, & Results Counter */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
            <div style={{ position: 'relative', minWidth: '240px', maxWidth: '340px', flex: 1 }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-dim)' }} />
              <input
                className="form-input"
                style={{ width: '100%', paddingLeft: '2.2rem', paddingRight: '2rem', fontSize: '0.82rem' }}
                placeholder="Cari kamera, petugas, atau template..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: 8,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Review Status Filter */}
            <select
              className="form-select"
              value={reviewFilter}
              onChange={(e) => setReviewFilter(e.target.value)}
              style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem', width: 'auto' }}
            >
              <option value="ALL">Semua Status Review</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending Review</option>
              <option value="REVISION_REQUESTED">Revisi Diminta</option>
            </select>
          </div>

          {/* Results Counter & Reset Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              Menampilkan <strong style={{ color: '#ffffff' }}>{filtered.length}</strong> dari <strong>{records.length}</strong> total laporan
            </span>

            {isFiltering && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={resetFilters}
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
              >
                <X size={13} /> Reset Filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)' }}>
              <th style={{ width: '40px', padding: '0.85rem 0.5rem 0.85rem 1rem' }}></th>
              <th style={{ padding: '0.85rem 1rem' }}>ID & WAKTU SUBMIT</th>
              <th style={{ padding: '0.85rem 1rem' }}>KAMERA & NVR</th>
              <th style={{ padding: '0.85rem 1rem' }}>PETUGAS (INSPECTOR)</th>
              <th style={{ padding: '0.85rem 1rem' }}>TEMPLATE FORM</th>
              <th style={{ padding: '0.85rem 1rem' }}>RINGKASAN HASIL</th>
              <th style={{ padding: '0.85rem 1.25rem' }}>STATUS REVIEW</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                  Tidak ada laporan hasil inspeksi yang sesuai dengan kriteria filter.
                </td>
              </tr>
            ) : (
              paginatedRecords.map((r) => {
                const isExpanded = expandedIds.has(r.id);
                const payloadEntries = Object.entries(r.payload || {});

                return (
                  <React.Fragment key={r.id}>
                    {/* MAIN ROW */}
                    <tr 
                      style={{ 
                        borderBottom: isExpanded ? 'none' : '1px solid var(--border-subtle)',
                        background: isExpanded ? 'rgba(2, 132, 199, 0.05)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                      onClick={() => toggleExpand(r.id)}
                    >
                      <td style={{ padding: '1rem 0.5rem 1rem 1rem', textAlign: 'center' }}>
                        <button
                          type="button"
                          style={{
                            background: isExpanded ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                            border: 'none',
                            borderRadius: '4px',
                            color: isExpanded ? 'var(--accent-cyan)' : 'var(--text-dim)',
                            width: '24px',
                            height: '24px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                          {r.id}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          {new Date(r.submitted_at).toLocaleString('id-ID')}
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                          <span style={{
                            padding: '1px 6px',
                            borderRadius: '3px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            background: r.camera_system === 'InaAI' ? 'rgba(14, 165, 233, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                            color: r.camera_system === 'InaAI' ? '#38bdf8' : '#c084fc',
                            border: `1px solid ${r.camera_system === 'InaAI' ? '#0ea5e9' : '#8b5cf6'}`,
                          }}>
                            {r.camera_system || 'InaAI'}
                          </span>
                          {r.camera_nvr && (
                            <span style={{ fontSize: '0.72rem', color: '#a5b4fc', fontFamily: 'var(--font-mono)' }}>
                              {r.camera_nvr} (Ch {r.camera_channel_no || 1})
                            </span>
                          )}
                        </div>
                        <div style={{ fontWeight: 600, color: 'white' }}>{r.camera_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{r.camera_code}</div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 600 }}>{r.inspector_name}</div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ background: 'rgba(2, 132, 199, 0.1)', color: '#38bdf8', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                          {r.template_name} (v{r.version_number})
                        </span>
                        {r.target_date && (
                          <div style={{ fontSize: '0.73rem', color: 'var(--text-dim)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            Target: <strong style={{ color: 'var(--text-main)' }}>{r.target_date}</strong>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '1rem', maxWidth: '320px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          {r.payload?.observation_time_slot && (
                            <span
                              style={{
                                background: 'rgba(99, 102, 241, 0.15)',
                                border: '1px solid rgba(99, 102, 241, 0.3)',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                fontSize: '0.72rem',
                                color: '#a5b4fc',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <Clock size={11} /> {String(r.payload.observation_time_slot)}
                            </span>
                          )}
                          {payloadEntries.filter(([k]) => k !== 'observation_time_slot').slice(0, 3).map(([k, v]) => (
                            <span
                              key={k}
                              style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                fontSize: '0.72rem',
                                color: 'var(--text-muted)',
                              }}
                            >
                              <strong>{formatKeyName(k)}:</strong> {typeof v === 'boolean' ? (v ? 'Ya' : 'Tidak') : String(v)}
                            </span>
                          ))}
                          {payloadEntries.filter(([k]) => k !== 'observation_time_slot').length > 3 && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                              +{payloadEntries.filter(([k]) => k !== 'observation_time_slot').length - 3} lainnya
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        {r.review_status === 'APPROVED' && (
                          <span className="status-pill status-done"><CheckCircle2 size={12} /> Approved</span>
                        )}
                        {r.review_status === 'PENDING' && (
                          <span className="status-pill status-in-progress"><Clock size={12} /> Pending</span>
                        )}
                        {r.review_status === 'REVISION_REQUESTED' && (
                          <span className="status-pill status-revision"><AlertTriangle size={12} /> Revisi</span>
                        )}
                      </td>
                    </tr>

                    {/* EXPANDED ACCORDION ROW */}
                    {isExpanded && (
                      <tr style={{ background: 'rgba(2, 132, 199, 0.03)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <td colSpan={7} style={{ padding: '0 1rem 1.5rem 3.5rem' }}>
                          <div style={{
                            background: 'var(--bg-card-subtle)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '8px',
                            padding: '1.25rem',
                            boxShadow: 'var(--shadow-sm)',
                          }}>
                            {/* Header Detail */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '0.75rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Layers size={16} color="#38bdf8" />
                                <strong style={{ fontSize: '0.92rem', color: 'white' }}>
                                  Rincian Lengkap Hasil Pengecekan ({r.template_name})
                                </strong>
                              </div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                                Versi Form: v{r.version_number} · Target: {r.target_date || '-'} · Task Ref: {r.task_id}
                              </span>
                            </div>

                            {/* Grid Hasil Observasi Dinamis */}
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                              gap: '0.75rem',
                              marginBottom: '1rem',
                            }}>
                              {payloadEntries.map(([key, value]) => {
                                const isPhoto = typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://')) && (value.includes('photo') || value.includes('images'));
                                const isTimeSlot = key === 'observation_time_slot';

                                return (
                                  <div
                                    key={key}
                                    style={{
                                      background: isTimeSlot ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                                      border: isTimeSlot ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid rgba(255, 255, 255, 0.06)',
                                      borderRadius: '6px',
                                      padding: '0.75rem',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: isTimeSlot ? '#a5b4fc' : 'var(--text-dim)', marginBottom: '4px' }}>
                                      {isTimeSlot && <Clock size={12} color="#818cf8" />}
                                      {isTimeSlot ? 'Slot Waktu Pengamatan' : formatKeyName(key)}
                                    </div>

                                    {isPhoto ? (
                                      <div style={{ marginTop: '4px' }}>
                                        <a href={value} target="_blank" rel="noopener noreferrer">
                                          <img
                                            src={value}
                                            alt={key}
                                            style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.1)' }}
                                          />
                                        </a>
                                      </div>
                                    ) : (
                                      <div style={{
                                        fontSize: typeof value === 'number' ? '1.15rem' : '0.9rem',
                                        fontWeight: typeof value === 'number' || isTimeSlot ? 700 : 500,
                                        color: isTimeSlot 
                                          ? '#e0e7ff' 
                                          : typeof value === 'boolean' 
                                          ? (value ? '#fb7185' : '#34d399') 
                                          : (typeof value === 'number' ? 'var(--accent-cyan)' : 'white'),
                                      }}>
                                        {typeof value === 'boolean' ? (value ? 'Ya' : 'Tidak') : String(value ?? '-')}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Inspector & Supervisor Notes */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                              {r.notes ? (
                                <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.75rem', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <MessageSquare size={13} color="#38bdf8" /> Catatan Petugas (Inspector):
                                  </div>
                                  <div style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{r.notes}</div>
                                </div>
                              ) : (
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontStyle: 'italic', padding: '0.5rem' }}>
                                  Tidak ada catatan tambahan petugas.
                                </div>
                              )}

                              {r.review_notes ? (
                                <div style={{ background: 'rgba(245, 158, 11, 0.05)', padding: '0.75rem', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                  <div style={{ fontSize: '0.75rem', color: '#fbbf24', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <AlertTriangle size={13} /> Catatan Review Supervisor ({r.reviewer_name || 'Supervisor'}):
                                  </div>
                                  <div style={{ fontSize: '0.85rem', color: 'white' }}>{r.review_notes}</div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* INTERACTIVE PAGINATION */}
      <div style={{ marginTop: '1rem' }}>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filtered.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          pageSizeOptions={[5, 10, 25, 50]}
        />
      </div>
      </>
      )}
    </div>
  );
};
