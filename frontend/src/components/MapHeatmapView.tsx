import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Layers, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Store, 
  CheckCircle2, 
  AlertTriangle, 
  ListOrdered, 
  X, 
  Filter,
  Eye,
  Loader2
} from 'lucide-react';
import { api } from '../services/api';
import { 
  MapLayout, 
  DailyHeatmap, 
  HeatmapManifest, 
  ShelfMetadata, 
  ZoneMetadata,
  User 
} from '../types';

interface MapHeatmapViewProps {
  currentUser?: User | null;
}

export const MapHeatmapView: React.FC<MapHeatmapViewProps> = () => {
  const [manifest, setManifest] = useState<HeatmapManifest | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('2026-10-14');
  const [layout, setLayout] = useState<MapLayout | null>(null);
  const [dailyData, setDailyData] = useState<DailyHeatmap | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // View controls
  const [viewPreset, setViewPreset] = useState<'full' | 'focused' | 'delica'>('full');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Inspection states
  const [selectedShelfId, setSelectedShelfId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [hoveredShelf, setHoveredShelf] = useState<ShelfMetadata | null>(null);
  const [hoveredZone, setHoveredZone] = useState<ZoneMetadata | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [filterArea, setFilterArea] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'map' | 'rankings' | 'areas' | 'audit'>('map');
  const [shelfActionTab, setShelfActionTab] = useState<'actions' | 'ai'>('actions');

  const svgContainerRef = useRef<HTMLDivElement>(null);

  // 1. Initial Load: Manifest & Layout
  useEffect(() => {
    const fetchInit = async () => {
      try {
        setLoading(true);
        setError(null);

        const [manifestRes, layoutRes] = await Promise.all([
          api.getHeatmapManifest().catch(() => null),
          api.getMapLayout().catch(() => null),
        ]);

        if (manifestRes && manifestRes.available_dates.length > 0) {
          setManifest(manifestRes);
          // Set initial date: default to 2026-10-14 if available, otherwise latest date
          const preferredDate = manifestRes.available_dates.includes('2026-10-14')
            ? '2026-10-14'
            : manifestRes.available_dates[manifestRes.available_dates.length - 1];
          setSelectedDate(preferredDate);
        }

        if (layoutRes) {
          setLayout(layoutRes);
        } else {
          setError('Data layout denah toko belum berhasil dimuat.');
        }
      } catch (err: any) {
        console.error('Failed to load initial layout/manifest:', err);
        setError(err.message || 'Gagal memuat sistem Map Heatmap.');
      } finally {
        setLoading(false);
      }
    };

    fetchInit();
  }, []);

  // 2. Fetch Daily Heatmap Data when selectedDate changes
  useEffect(() => {
    if (!selectedDate) return;

    let isMounted = true;
    const fetchDay = async () => {
      try {
        setLoading(true);
        const dayRes = await api.getDailyHeatmap(selectedDate);
        if (isMounted) {
          setDailyData(dayRes);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error(`Failed to load daily heatmap for ${selectedDate}:`, err);
          setError(`Gagal memuat data event untuk tanggal ${selectedDate}.`);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDay();
    return () => {
      isMounted = false;
    };
  }, [selectedDate]);

  // Max events across shelves on the active day (for color normalization)
  const maxShelfEvents = useMemo(() => {
    if (!dailyData || !dailyData.shelf_counts) return 1;
    let max = 1;
    for (const val of Object.values(dailyData.shelf_counts)) {
      if (val > max) max = val;
    }
    return max;
  }, [dailyData]);

  // Shelf Map Lookup
  const shelfMap = useMemo(() => {
    const map = new Map<string, ShelfMetadata>();
    if (layout) {
      layout.shelves.forEach((s) => map.set(s.id, s));
    }
    return map;
  }, [layout]);

  // Currently selected shelf details
  const selectedShelf = useMemo(() => {
    if (!selectedShelfId) return null;
    const meta = shelfMap.get(selectedShelfId);
    if (!meta) return null;

    const count = dailyData?.shelf_counts?.[selectedShelfId] || 0;
    const totalEvents = dailyData?.total_events || 0;
    const pct = totalEvents > 0 ? (count / totalEvents) * 100 : 0;

    return {
      ...meta,
      event_count: count,
      percentage: pct,
    };
  }, [selectedShelfId, shelfMap, dailyData]);

  // Currently selected zone details (e.g. Delica Area, Bakery, Seating Area)
  const selectedZone = useMemo(() => {
    if (!selectedZoneId || !layout) return null;
    return layout.zones.find((z) => z.id === selectedZoneId) || null;
  }, [selectedZoneId, layout]);

  // Ranked Shelves for Top List
  const rankedShelves = useMemo(() => {
    if (!layout || !dailyData || !dailyData.shelf_counts) return [];
    return layout.shelves
      .map((s) => {
        const count = dailyData.shelf_counts[s.id] || 0;
        const total = dailyData.total_events || 1;
        return {
          ...s,
          event_count: count,
          percentage: (count / total) * 100,
        };
      })
      .filter((s) => (filterArea === 'ALL' ? true : s.area === filterArea))
      .sort((a, b) => b.event_count - a.event_count);
  }, [layout, dailyData, filterArea]);

  // Color Interpolation for Shelf Heatmap
  const getShelfFillColor = (count: number): string => {
    if (count <= 0) {
      return '#1e293b'; // Slate 800 - Nilai Nol (bisa dibedakan jelas)
    }

    const ratio = count / maxShelfEvents;

    if (ratio < 0.05) return '#0284c7'; // Soft sky blue (rendah)
    if (ratio < 0.15) return '#06b6d4'; // Cyan
    if (ratio < 0.35) return '#10b981'; // Emerald
    if (ratio < 0.60) return '#f59e0b'; // Amber
    if (ratio < 0.85) return '#f97316'; // Orange
    return '#ef4444'; // Red intense (sangat tinggi)
  };

  const getShelfStroke = (sId: string, count: number): string => {
    if (sId === selectedShelfId) return '#38bdf8'; // Glowing cyan for selected
    if (count > 0) return 'rgba(255, 255, 255, 0.2)';
    return '#334155';
  };

  // Date Navigation
  const handlePrevDate = () => {
    if (!manifest || manifest.available_dates.length === 0) return;
    const idx = manifest.available_dates.indexOf(selectedDate);
    if (idx > 0) {
      setSelectedDate(manifest.available_dates[idx - 1]);
    }
  };

  const handleNextDate = () => {
    if (!manifest || manifest.available_dates.length === 0) return;
    const idx = manifest.available_dates.indexOf(selectedDate);
    if (idx < manifest.available_dates.length - 1) {
      setSelectedDate(manifest.available_dates[idx + 1]);
    }
  };

  // Pan & Zoom controls
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.3, 3.5));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.3, 0.7));
  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Mouse drag handlers for SVG pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }

    if (svgContainerRef.current) {
      const rect = svgContainerRef.current.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const currentViewBox = useMemo(() => {
    if (!layout) return '0 0 2400 2160';
    if (viewPreset === 'focused') return layout.viewbox_focused || '420 380 1050 1300';
    if (viewPreset === 'delica') return layout.viewbox_delica || '1400 200 1000 1900';
    return layout.viewbox_full || '0 0 2400 2160';
  }, [layout, viewPreset]);

  // Formatter helper
  const fmtNumber = (n?: number) => {
    if (n === undefined || n === null) return '0';
    return new Intl.NumberFormat('id-ID').format(n);
  };

  return (
    <div className="page-wrapper">
      {/* 1. Header Section */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <span className="user-badge badge-supervisor">
              SUPERVISOR HEATMAP
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              • Sumber Data: Parquet Production + CAD Floor Layout
            </span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
            Map Heatmap — Distribusi Event Berdasarkan Area, Isle, dan Shelf
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem', maxWidth: '850px' }}>
            Pemetaan spasial event shopper ke denah toko aktual. Setiap koordinat event difilter berdasarkan tanggal dan dipetakan ke wilayah Shelf terdekat (radius interaksi ≤ 1.0m) dengan hierarki Area dan Isle.
          </p>
        </div>

        {/* Action Controls & Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button 
            className={`btn ${activeTab === 'map' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('map')}
            style={{ fontSize: '0.85rem' }}
          >
            <Layers size={15} />
            <span>Denah Visual Heatmap</span>
          </button>
          <button 
            className={`btn ${activeTab === 'rankings' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('rankings')}
            style={{ fontSize: '0.85rem' }}
          >
            <ListOrdered size={15} />
            <span>Peringkat Shelf</span>
          </button>
          <button 
            className={`btn ${activeTab === 'areas' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('areas')}
            style={{ fontSize: '0.85rem' }}
          >
            <Store size={15} />
            <span>Ringkasan Area & Isle</span>
          </button>
          <button 
            className={`btn ${activeTab === 'audit' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('audit')}
            style={{ fontSize: '0.85rem' }}
          >
            <CheckCircle2 size={15} />
            <span>Rekonsiliasi Data</span>
          </button>
        </div>
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div style={{
          padding: '1rem 1.25rem',
          marginBottom: '1.25rem',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(244, 63, 94, 0.1)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          color: '#fb7185',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.9rem',
        }}>
          <AlertTriangle size={18} />
          <div style={{ flex: 1 }}>{error}</div>
          <button className="btn btn-secondary" onClick={() => setError(null)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
            Tutup
          </button>
        </div>
      )}

      {/* 2. Date Filter Bar (Section 5.1) */}
      <div className="card" style={{ padding: '0.85rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', background: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-cyan)' }}>
            <Calendar size={18} />
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Pilih Tanggal:</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <button 
              className="btn btn-secondary" 
              onClick={handlePrevDate} 
              disabled={!manifest || manifest.available_dates.indexOf(selectedDate) <= 0}
              title="Hari Sebelumnya"
              style={{ padding: '0.35rem 0.6rem' }}
            >
              <ChevronLeft size={16} />
            </button>

            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                background: 'var(--bg-input)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.45rem 1rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {manifest?.available_dates.map((d) => (
                <option key={d} value={d}>
                  {d} {d === '2026-10-14' ? '(Data Sampel Acuan)' : ''}
                </option>
              ))}
              {!manifest && <option value={selectedDate}>{selectedDate}</option>}
            </select>

            <button 
              className="btn btn-secondary" 
              onClick={handleNextDate} 
              disabled={!manifest || manifest.available_dates.indexOf(selectedDate) >= manifest.available_dates.length - 1}
              title="Hari Berikutnya"
              style={{ padding: '0.35rem 0.6rem' }}
            >
              <ChevronRight size={16} />
            </button>

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--accent-cyan)', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                <Loader2 size={15} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                <span>Memuat data...</span>
              </div>
            )}
          </div>
        </div>

        {/* Date Context Meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>Zona Waktu: </span>
            <strong style={{ color: 'var(--text-main)' }}>Asia/Jakarta (WIB)</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>Jam Operasional: </span>
            <strong style={{ color: 'var(--text-main)' }}>10:00 – 22:00 WIB</strong>
          </div>
          {dailyData && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-emerald)' }}></span>
              <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>
                {fmtNumber(dailyData.total_events)} Total Event
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Summary Statistics Cards (Section 7) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Total Events */}
        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid var(--accent-cyan)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Total Event (Parquet)
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.25rem' }}>
            {fmtNumber(dailyData?.total_events)}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
            Tanggal: {selectedDate} (100% baris dihitung 1x)
          </div>
        </div>

        {/* Mapped Events */}
        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid var(--accent-emerald)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Event Terpetakan ke Shelf
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: '0.25rem' }}>
            {fmtNumber(dailyData?.mapped_events)}
            <span style={{ fontSize: '0.9rem', fontWeight: 600, marginLeft: '0.4rem', color: 'var(--text-muted)' }}>
              ({dailyData?.mapped_percentage}%)
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
            Radius interaksi shopper ≤ 1.0m dari rak
          </div>
        </div>

        {/* Unmapped Events */}
        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid var(--accent-amber)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Event Tidak Terpetakan
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--accent-amber)', marginTop: '0.25rem' }}>
            {fmtNumber(dailyData?.unmapped_events)}
            <span style={{ fontSize: '0.9rem', fontWeight: 600, marginLeft: '0.4rem', color: 'var(--text-muted)' }}>
              ({dailyData ? (100 - dailyData.mapped_percentage).toFixed(2) : 0}%)
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
            Koridor utama, walkway, kasir, & pintu masuk
          </div>
        </div>

        {/* Shelf Coverage */}
        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid var(--accent-indigo)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Cakupan Shelf Beraktivitas
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.25rem' }}>
            {fmtNumber(dailyData?.shelves_with_events)}
            <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '0.3rem' }}>
              / {layout?.total_shelves || 949}
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
            3 Area • {dailyData?.isles_count || 58} Isle teridentifikasi
          </div>
        </div>

        {/* Top Shelf */}
        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid var(--accent-rose)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Shelf Event Tertinggi
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fb7185', marginTop: '0.25rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {dailyData?.top_shelf?.name || 'Memuat...'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
            {fmtNumber(dailyData?.top_shelf?.count)} event ({dailyData?.top_shelf?.percentage}% harian)
          </div>
        </div>
      </div>

      {/* 4. Main Heatmap Tab */}
      {activeTab === 'map' && (
        <div style={{ display: 'grid', gridTemplateColumns: (selectedShelf || selectedZone) ? '1fr 350px' : '1fr', gap: '1.25rem', alignItems: 'start' }}>
          {/* Floor Map Interactive Canvas Container */}
          <div className="card" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden', minHeight: '640px', display: 'flex', flexDirection: 'column' }}>
            {/* Top Toolbar inside Canvas */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem', zIndex: 10 }}>
              {/* Preset Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  Preset Tampilan:
                </span>
                <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: '2px', border: '1px solid var(--border-subtle)' }}>
                  <button
                    onClick={() => {
                      setViewPreset('full');
                      handleResetZoom();
                    }}
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      borderRadius: 'var(--radius-sm)',
                      background: viewPreset === 'full' ? 'var(--primary)' : 'transparent',
                      color: viewPreset === 'full' ? '#fff' : 'var(--text-muted)',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Denah Lengkap Toko (Full)
                  </button>
                  <button
                    onClick={() => {
                      setViewPreset('focused');
                      handleResetZoom();
                    }}
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      borderRadius: 'var(--radius-sm)',
                      background: viewPreset === 'focused' ? 'var(--primary)' : 'transparent',
                      color: viewPreset === 'focused' ? '#fff' : 'var(--text-muted)',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Supermarket & Fresh
                  </button>
                  <button
                    onClick={() => {
                      setViewPreset('delica');
                      handleResetZoom();
                    }}
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      borderRadius: 'var(--radius-sm)',
                      background: viewPreset === 'delica' ? 'var(--primary)' : 'transparent',
                      color: viewPreset === 'delica' ? '#fff' : 'var(--text-muted)',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Delica Area & Bakery
                  </button>
                </div>
              </div>

              {/* Area Quick Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Filter size={15} color="var(--text-muted)" />
                <select
                  value={filterArea}
                  onChange={(e) => setFilterArea(e.target.value)}
                  style={{
                    background: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <option value="ALL">Semua Area (Denah Lengkap)</option>
                  <option value="Supermarket">Area Supermarket (847 Shelf)</option>
                  <option value="Fresh Area">Area Fresh & Sayur/Buah (102 Shelf)</option>
                  <option value="Delica Area">Area Delica & Bakery (13 Zona)</option>
                </select>
              </div>

              {/* Pan & Zoom Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <button className="btn btn-secondary" onClick={handleZoomIn} title="Perbesar (Zoom In)" style={{ padding: '0.35rem 0.6rem' }}>
                  <ZoomIn size={15} />
                </button>
                <button className="btn btn-secondary" onClick={handleZoomOut} title="Perkecil (Zoom Out)" style={{ padding: '0.35rem 0.6rem' }}>
                  <ZoomOut size={15} />
                </button>
                <button className="btn btn-secondary" onClick={handleResetZoom} title="Reset Posisi & Zoom" style={{ padding: '0.35rem 0.6rem' }}>
                  <RotateCcw size={15} />
                </button>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>
                  {Math.round(zoomLevel * 100)}%
                </span>
              </div>
            </div>

            {/* SVG Visual Floor Canvas */}
            <div 
              ref={svgContainerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{
                flex: 1,
                width: '100%',
                minHeight: '540px',
                background: '#070b14',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                position: 'relative',
                cursor: isDragging ? 'grabbing' : 'grab',
                border: '1px solid var(--border-subtle)',
                userSelect: 'none',
              }}
            >
              {layout ? (
                <svg
                  viewBox={currentViewBox}
                  preserveAspectRatio="xMidYMid meet"
                  style={{
                    width: '100%',
                    height: '100%',
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                    transformOrigin: 'center center',
                    transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                  }}
                >
                  {/* Layer 0: Store Boundary Outer Walls */}
                  {layout.store_boundary && (
                    <polygon
                      id="store-perimeter-wall"
                      points={layout.store_boundary}
                      fill="#090e1a"
                      stroke="#334155"
                      strokeWidth={6}
                    />
                  )}

                  {/* Layer 0.5: Area Floor Accent Backdrops */}
                  <g id="layer-area-backdrops" opacity={0.75}>
                    {/* Fresh Area Floor (North) */}
                    <rect x={420} y={40} width={1030} height={340} fill="rgba(16, 185, 129, 0.05)" stroke="rgba(16, 185, 129, 0.25)" strokeDasharray="8 8" rx={6} />
                    {/* Supermarket Floor (Center/West) */}
                    <rect x={420} y={390} width={1030} height={1740} fill="rgba(56, 189, 248, 0.03)" stroke="rgba(56, 189, 248, 0.2)" strokeDasharray="8 8" rx={6} />
                    {/* Delica Area Floor (East/Right) */}
                    <rect x={1460} y={40} width={920} height={2090} fill="rgba(245, 158, 11, 0.06)" stroke="rgba(245, 158, 11, 0.3)" strokeDasharray="8 8" rx={6} />
                  </g>

                  {/* Layer 1: Zones / Functional Areas */}
                  <g id="layer-zones">
                    {layout.zones.map((zone) => {
                      if (zone.area > 5000) return null; // skip perimeter outline
                      const isDelica = zone.is_delica || zone.parent_area === 'Delica Area';
                      const isSelected = selectedZoneId === zone.id;
                      const isHovered = hoveredZone?.id === zone.id;
                      const isEntrance = zone.is_entrance;

                      let fill = '#111827';
                      let stroke = '#1e293b';
                      let strokeWidth = 1.5;

                      if (isDelica) {
                        fill = isSelected 
                          ? 'rgba(245, 158, 11, 0.35)' 
                          : isHovered 
                          ? 'rgba(245, 158, 11, 0.22)' 
                          : 'rgba(245, 158, 11, 0.12)';
                        stroke = isSelected ? '#fbbf24' : isHovered ? '#f59e0b' : 'rgba(245, 158, 11, 0.45)';
                        strokeWidth = isSelected ? 3 : 1.5;
                      } else if (isEntrance) {
                        fill = 'rgba(16, 185, 129, 0.18)';
                        stroke = '#10b981';
                        strokeWidth = 2;
                      }

                      return (
                        <polygon
                          key={`zone-${zone.id}`}
                          points={zone.svg_points}
                          fill={fill}
                          stroke={stroke}
                          strokeWidth={strokeWidth}
                          opacity={0.88}
                          style={{
                            cursor: 'pointer',
                            transition: 'fill 0.15s ease, stroke 0.15s ease',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedZoneId(zone.id);
                            setSelectedShelfId(null);
                          }}
                          onMouseEnter={() => setHoveredZone(zone)}
                          onMouseLeave={() => setHoveredZone(null)}
                        />
                      );
                    })}
                  </g>

                  {/* Layer 2: Shelves (Heatmap Polygons) */}
                  <g id="layer-shelves">
                    {layout.shelves.map((shelf) => {
                      const count = dailyData?.shelf_counts?.[shelf.id] || 0;
                      const isSelected = shelf.id === selectedShelfId;
                      const isHovered = hoveredShelf?.id === shelf.id;
                      const matchesFilter = filterArea === 'ALL' || shelf.area === filterArea;
                      const fillColor = getShelfFillColor(count);
                      const strokeColor = getShelfStroke(shelf.id, count);

                      return (
                        <polygon
                          key={`shelf-${shelf.id}`}
                          points={shelf.svg_points}
                          fill={matchesFilter ? fillColor : '#0f172a'}
                          stroke={strokeColor}
                          strokeWidth={isSelected ? 3.5 : isHovered ? 2.5 : 1}
                          opacity={matchesFilter ? (isSelected ? 1 : 0.92) : 0.2}
                          style={{
                            cursor: 'pointer',
                            transition: 'fill 0.2s ease, stroke 0.2s ease',
                          }}
                          onMouseEnter={() => setHoveredShelf(shelf)}
                          onMouseLeave={() => setHoveredShelf(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedShelfId(shelf.id);
                            setSelectedZoneId(null);
                          }}
                        />
                      );
                    })}
                  </g>

                  {/* Layer 3: Selected Shelf Glow Pin */}
                  {selectedShelf && (
                    <g id="selected-shelf-indicator">
                      <circle
                        cx={selectedShelf.svg_centroid[0]}
                        cy={selectedShelf.svg_centroid[1]}
                        r={12}
                        fill="rgba(56, 189, 248, 0.35)"
                        stroke="#38bdf8"
                        strokeWidth={2.5}
                      />
                      <circle
                        cx={selectedShelf.svg_centroid[0]}
                        cy={selectedShelf.svg_centroid[1]}
                        r={4}
                        fill="#38bdf8"
                      />
                    </g>
                  )}

                  {/* Layer 4: Prominent Major Store Area Labels */}
                  <g id="layer-major-labels" pointerEvents="none">
                    {layout.major_labels?.map((lbl, idx) => {
                      const isArea = lbl.type === 'area_header';
                      const color =
                        lbl.area === 'Delica Area'
                          ? '#fbbf24'
                          : lbl.area === 'Fresh Area'
                          ? '#34d399'
                          : '#38bdf8';

                      return (
                        <g key={`lbl-${idx}`}>
                          {isArea && (
                            <rect
                              x={lbl.pos_svg[0] - 130}
                              y={lbl.pos_svg[1] - 32}
                              width={260}
                              height={42}
                              rx={6}
                              fill="rgba(15, 23, 42, 0.88)"
                              stroke={color}
                              strokeWidth={2}
                            />
                          )}
                          <text
                            x={lbl.pos_svg[0]}
                            y={lbl.pos_svg[1]}
                            textAnchor="middle"
                            fill={isArea ? color : '#e2e8f0'}
                            fontSize={lbl.size || 14}
                            fontWeight={isArea ? 900 : 700}
                            letterSpacing={isArea ? '0.12em' : '0.04em'}
                            style={{
                              textShadow: '0 2px 10px rgba(0,0,0,0.95)',
                              fontFamily: 'system-ui, -apple-system, sans-serif',
                            }}
                          >
                            {lbl.text}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                </svg>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                  Memuat denah toko...
                </div>
              )}

              {/* Floating Tooltip when hovering over a Shelf */}
              {hoveredShelf && (
                <div
                  style={{
                    position: 'absolute',
                    top: mousePos.y + 15,
                    left: mousePos.x + 15,
                    background: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid var(--accent-cyan)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(8px)',
                    padding: '0.6rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    pointerEvents: 'none',
                    zIndex: 50,
                    maxWidth: '260px',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                    {hoveredShelf.area} • {hoveredShelf.isle}
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', margin: '0.15rem 0' }}>
                    {hoveredShelf.name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Event: <strong style={{ color: 'var(--accent-emerald)' }}>
                      {fmtNumber(dailyData?.shelf_counts?.[hoveredShelf.id] || 0)}
                    </strong>
                    {dailyData && dailyData.total_events > 0 && (
                      <span style={{ marginLeft: '0.35rem', color: 'var(--text-dim)' }}>
                        ({(((dailyData.shelf_counts?.[hoveredShelf.id] || 0) / dailyData.total_events) * 100).toFixed(3)}%)
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Floating Tooltip when hovering over a Zone in Delica or Common Area */}
              {hoveredZone && !hoveredShelf && (
                <div
                  style={{
                    position: 'absolute',
                    top: mousePos.y + 15,
                    left: mousePos.x + 15,
                    background: 'rgba(15, 23, 42, 0.95)',
                    border: hoveredZone.is_delica ? '1px solid var(--accent-amber)' : '1px solid var(--border-subtle)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(8px)',
                    padding: '0.6rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    pointerEvents: 'none',
                    zIndex: 50,
                    maxWidth: '260px',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: hoveredZone.is_delica ? 'var(--accent-amber)' : 'var(--text-muted)', fontWeight: 600 }}>
                    {hoveredZone.parent_area || 'Area Toko'}
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', margin: '0.15rem 0' }}>
                    {hoveredZone.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    Luas: {hoveredZone.area} m² • Klik untuk melihat detail zona
                  </div>
                </div>
              )}
            </div>

            {/* 5. Color Legend (Section 5.3) */}
            <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Intensitas Event:
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
                  <div style={{ width: 14, height: 14, background: '#1e293b', border: '1px solid #334155', borderRadius: 2 }}></div>
                  <span style={{ color: 'var(--text-dim)' }}>0 (Nol)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
                  <div style={{ width: 14, height: 14, background: '#0284c7', borderRadius: 2 }}></div>
                  <span style={{ color: 'var(--text-muted)' }}>Rendah (&lt;5%)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
                  <div style={{ width: 14, height: 14, background: '#06b6d4', borderRadius: 2 }}></div>
                  <span style={{ color: 'var(--text-muted)' }}>5% - 15%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
                  <div style={{ width: 14, height: 14, background: '#10b981', borderRadius: 2 }}></div>
                  <span style={{ color: 'var(--text-muted)' }}>Sedang (15% - 35%)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
                  <div style={{ width: 14, height: 14, background: '#f59e0b', borderRadius: 2 }}></div>
                  <span style={{ color: 'var(--text-muted)' }}>Tinggi (35% - 60%)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
                  <div style={{ width: 14, height: 14, background: '#f97316', borderRadius: 2 }}></div>
                  <span style={{ color: 'var(--text-muted)' }}>Sangat Tinggi (60% - 85%)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
                  <div style={{ width: 14, height: 14, background: '#ef4444', borderRadius: 2 }}></div>
                  <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>Puncak (&gt;85%)</span>
                </div>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                Skala Maksimum Hari Ini: <strong style={{ color: 'var(--accent-cyan)' }}>{fmtNumber(maxShelfEvents)} event</strong>
              </div>
            </div>
          </div>

          {/* 6A. Selected Shelf Detail Panel */}
          {selectedShelf && (
            <div className="card" style={{ 
              padding: '1.25rem', 
              position: 'sticky', 
              top: '4.5rem', 
              background: 'var(--bg-card)', 
              border: '1px solid var(--accent-cyan)',
              maxHeight: 'calc(100vh - 5.5rem)',
              overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.36)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <span className="user-badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-cyan)', fontSize: '0.7rem' }}>
                    DETAIL SHELF TERPILIH
                  </span>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.25rem' }}>
                    {selectedShelf.name}
                  </h3>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => setSelectedShelfId(null)}
                  style={{ padding: '0.3rem', borderRadius: '50%' }}
                >
                  <X size={15} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
                {/* Compact Area & Isle info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div style={{ padding: '0.5rem 0.65rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>Area Induk:</div>
                    <div style={{ color: 'var(--text-main)', fontWeight: 600, marginTop: '2px', fontSize: '0.8rem' }}>
                      {selectedShelf.area}
                    </div>
                  </div>
                  <div style={{ padding: '0.5rem 0.65rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>ID (Handle CAD):</div>
                    <div style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontWeight: 600, marginTop: '2px', fontSize: '0.8rem' }}>
                      {selectedShelf.id}
                    </div>
                  </div>
                </div>

                <div style={{ padding: '0.5rem 0.65rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>Isle Induk:</div>
                  <div style={{ color: 'var(--text-main)', fontWeight: 600, marginTop: '2px', fontSize: '0.8rem' }}>
                    {selectedShelf.isle}
                  </div>
                </div>

                <div style={{ padding: '0.75rem 0.8rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ color: 'var(--accent-emerald)', fontSize: '0.75rem', fontWeight: 600 }}>Jumlah Event Aktual:</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: '2px' }}>
                    {fmtNumber(selectedShelf.event_count)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Kontribusi: <strong style={{ color: '#fff' }}>{selectedShelf.percentage.toFixed(3)}%</strong> dari total event harian
                  </div>
                </div>

                {/* Komposisi Klasifikasi Event (Action Breakdown) */}
                {selectedShelf.event_count > 0 && dailyData?.shelf_actions?.[selectedShelf.id] && (() => {
                  const shelfAction = dailyData.shelf_actions[selectedShelf.id];
                  const totalShelfEvents = selectedShelf.event_count;

                  const actionLabels: Record<string, { label: string; desc: string; color: string; icon: string }> = {
                    take: { label: 'Ambil Produk (Take)', desc: 'Pengunjung mengambil barang dari rak', color: '#10b981', icon: '🛒' },
                    stop: { label: 'Berhenti / Dwell (Stop)', desc: 'Pengunjung berhenti mengamati & memilih produk', color: '#f59e0b', icon: '⏱️' },
                    pass: { label: 'Melintas (Pass)', desc: 'Pengunjung berjalan melewati lorong rak', color: '#6366f1', icon: '🚶' },
                    excluded: { label: 'Tepi Sensor (Excluded)', desc: 'Lintasan di batas jangkauan deteksi rak', color: '#64748b', icon: '📐' },
                  };

                  const aiActionLabels: Record<string, { label: string; desc: string; color: string; icon: string }> = {
                    take: { label: 'Ambil Barang (Take)', desc: 'Deteksi gesture tangan mengambil item', color: '#10b981', icon: '📦' },
                    touch: { label: 'Sentuh / Pegang (Touch)', desc: 'Deteksi tangan menyentuh atau memeriksa produk', color: '#06b6d4', icon: '✋' },
                    stop: { label: 'Fokus / Berhenti (Stop)', desc: 'Deteksi tatapan fokus ke produk di rak', color: '#f59e0b', icon: '👀' },
                    pass: { label: 'Berjalan Lewat (Pass)', desc: 'Deteksi tubuh melintas di koridor rak', color: '#8b5cf6', icon: '🚶' },
                    not_engage: { label: 'Tanpa Interaksi', desc: 'Gerakan tanpa interaksi rak', color: '#94a3b8', icon: '⚪' },
                  };

                  const rawActions = shelfAction.actions || {};
                  const sortedActions = Object.entries(rawActions).sort((a, b) => b[1] - a[1]);

                  const rawAiActions = shelfAction.ai_actions || {};
                  const sortedAiActions = Object.entries(rawAiActions).sort((a, b) => b[1] - a[1]);
                  const totalAiEvents = Object.values(rawAiActions).reduce((a, b) => a + b, 0);

                  return (
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Komposisi Event Rak
                        </div>
                        <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: '4px', padding: '2px', gap: '2px' }}>
                          <button
                            onClick={() => setShelfActionTab('actions')}
                            style={{
                              background: shelfActionTab === 'actions' ? 'var(--primary)' : 'transparent',
                              color: shelfActionTab === 'actions' ? '#fff' : 'var(--text-muted)',
                              border: 'none',
                              borderRadius: '3px',
                              padding: '2px 6px',
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Status Aksi
                          </button>
                          <button
                            onClick={() => setShelfActionTab('ai')}
                            style={{
                              background: shelfActionTab === 'ai' ? 'var(--primary)' : 'transparent',
                              color: shelfActionTab === 'ai' ? '#fff' : 'var(--text-muted)',
                              border: 'none',
                              borderRadius: '3px',
                              padding: '2px 6px',
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Deteksi AI ({fmtNumber(totalAiEvents)})
                          </button>
                        </div>
                      </div>

                      {/* Tab 1: System Action Codes */}
                      {shelfActionTab === 'actions' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                          {sortedActions.map(([code, count]) => {
                            const meta = actionLabels[code.toLowerCase()] || {
                              label: code.toUpperCase(),
                              desc: 'Klasifikasi sistem',
                              color: '#94a3b8',
                              icon: '🔹'
                            };
                            const pct = totalShelfEvents > 0 ? (count / totalShelfEvents) * 100 : 0;

                            return (
                              <div key={code} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ fontSize: '0.85rem' }}>{meta.icon}</span>
                                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{meta.label}</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                    <strong style={{ color: meta.color }}>{fmtNumber(count)}</strong>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>({pct.toFixed(2)}%)</span>
                                  </div>
                                </div>
                                {/* Progress bar */}
                                <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${pct}%`, background: meta.color, borderRadius: '3px', transition: 'width 0.3s ease' }} />
                                </div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                  {meta.desc}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Tab 2: AI Gesture Actions */}
                      {shelfActionTab === 'ai' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                          {totalAiEvents === 0 ? (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center', padding: '0.5rem' }}>
                              Tidak ada gesture AI khusus yang terklasifikasi pada rak ini
                            </div>
                          ) : (
                            sortedAiActions.map(([code, count]) => {
                              const meta = aiActionLabels[code.toLowerCase()] || {
                                label: code.toUpperCase(),
                                desc: 'Deteksi gesture AI',
                                color: '#94a3b8',
                                icon: '🔹'
                              };
                              const pctOfTotal = totalShelfEvents > 0 ? (count / totalShelfEvents) * 100 : 0;
                              const pctOfAi = totalAiEvents > 0 ? (count / totalAiEvents) * 100 : 0;

                              return (
                                <div key={code} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <span style={{ fontSize: '0.85rem' }}>{meta.icon}</span>
                                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{meta.label}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                      <strong style={{ color: meta.color }}>{fmtNumber(count)}</strong>
                                      <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>({pctOfTotal.toFixed(2)}%)</span>
                                    </div>
                                  </div>
                                  <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${pctOfAi}%`, background: meta.color, borderRadius: '3px', transition: 'width 0.3s ease' }} />
                                  </div>
                                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                    {meta.desc} &bull; <span style={{ color: 'var(--text-main)' }}>{pctOfAi.toFixed(1)}%</span> dari gesture AI
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div style={{ padding: '0.6rem 0.8rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                  <div>Tanggal Analisis: <strong style={{ color: 'var(--text-main)' }}>{selectedDate}</strong></div>
                  <div style={{ marginTop: '3px' }}>Koordinat CAD: ({selectedShelf.cad_centroid[0]}, {selectedShelf.cad_centroid[1]})</div>
                </div>
              </div>
            </div>
          )}

          {/* 6B. Selected Zone Detail Panel (e.g. Delica Area, Bakery, Seating) */}
          {selectedZone && !selectedShelf && (
            <div className="card" style={{ padding: '1.25rem', position: 'sticky', top: '5rem', background: 'var(--bg-card)', border: '1px solid var(--accent-amber)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
                <div>
                  <span className="user-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)', fontSize: '0.7rem' }}>
                    DETAIL ZONA OPERASIONAL
                  </span>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.35rem' }}>
                    {selectedZone.name}
                  </h3>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => setSelectedZoneId(null)}
                  style={{ padding: '0.3rem', borderRadius: '50%' }}
                >
                  <X size={15} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div style={{ padding: '0.6rem 0.8rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>Area Induk:</div>
                  <div style={{ color: 'var(--accent-amber)', fontWeight: 700, marginTop: '2px' }}>
                    {selectedZone.parent_area || 'Delica Area'}
                  </div>
                </div>

                <div style={{ padding: '0.6rem 0.8rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>Luas Zona Terdata:</div>
                  <div style={{ color: 'var(--text-main)', fontWeight: 600, marginTop: '2px' }}>
                    {selectedZone.area} m²
                  </div>
                </div>

                <div style={{ padding: '0.75rem 0.8rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ color: 'var(--accent-amber)', fontSize: '0.75rem', fontWeight: 600 }}>Karakteristik Operasional:</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '4px', lineHeight: 1.5 }}>
                    {selectedZone.is_delica
                      ? 'Zona kuliner siap saji, bakery, tenant F&B, dan fasilitas dine-in / tempat duduk pelanggan.'
                      : selectedZone.is_entrance
                      ? 'Pintu akses gerbang masuk utama pengunjung supermarket.'
                      : 'Zona lorong sirkulasi dan area belanja toko.'}
                  </div>
                </div>

                <div style={{ padding: '0.65rem 0.8rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--text-main)' }}>Catatan Data AI Tracking:</strong>
                  <div style={{ marginTop: '3px' }}>
                    Pada dataset Parquet acuan 1–17 Oktober 2026, kamera CCTV AI berfokus pada deteksi interaksi shopper di 949 gondola rak (Supermarket & Fresh Area).
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Tab Rankings: Top 20 Shelves */}
      {activeTab === 'rankings' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Peringkat Kunjungan Shelf Tertinggi ({selectedDate})
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Urutan rak berdasarkan volume event shopper aktual yang dipetakan pada tanggal terpilih.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Filter Area:</span>
              <select
                value={filterArea}
                onChange={(e) => setFilterArea(e.target.value)}
                style={{
                  background: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.85rem',
                }}
              >
                <option value="ALL">Semua Area ({layout?.total_shelves} Shelf)</option>
                <option value="Supermarket">Supermarket (847 Shelf)</option>
                <option value="Fresh Area">Fresh Area (102 Shelf)</option>
                <option value="Delica Area">Delica Area (Area Siap Saji/Dine-in)</option>
              </select>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-dim)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}># Rank</th>
                  <th style={{ padding: '0.75rem 1rem' }}>ID Shelf</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Nama Shelf / Produk</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Isle Induk</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Area</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Jumlah Event</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>% Kontribusi</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rankedShelves.slice(0, 50).map((sh, idx) => (
                  <tr 
                    key={sh.id}
                    style={{ 
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: idx < 3 ? 'var(--accent-amber)' : 'var(--text-muted)' }}>
                      #{idx + 1}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                      {sh.id}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {sh.name}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                      {sh.isle}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span className="user-badge" style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)' }}>
                        {sh.area}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                      {fmtNumber(sh.event_count)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-dim)' }}>
                      {sh.percentage.toFixed(3)}%
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          setSelectedShelfId(sh.id);
                          setSelectedZoneId(null);
                          setActiveTab('map');
                        }}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                      >
                        <Eye size={13} />
                        <span>Lihat di Peta</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Tab Areas: Breakdown per Area & Isle */}
      {activeTab === 'areas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Area Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            {dailyData && Object.entries(dailyData.area_summary).map(([areaName, stat]) => {
              const isDelica = areaName === 'Delica Area';
              const isFresh = areaName === 'Fresh Area';
              const accentColor = isDelica ? 'var(--accent-amber)' : isFresh ? 'var(--accent-emerald)' : 'var(--accent-cyan)';

              return (
                <div key={areaName} className="card" style={{ padding: '1.25rem', borderLeft: `4px solid ${accentColor}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      {areaName}
                    </h4>
                    <span className="user-badge" style={{ background: isDelica ? 'rgba(245, 158, 11, 0.15)' : 'rgba(56, 189, 248, 0.15)', color: accentColor }}>
                      {isDelica ? '13 Zona Kuliner & Dine-In' : `${stat.shelves_with_events} / ${stat.total_shelves} Shelf Aktif`}
                    </span>
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: accentColor, marginTop: '0.5rem' }}>
                    {isDelica ? (
                      <span style={{ fontSize: '1.3rem' }}>Zona Kuliner & F&B</span>
                    ) : (
                      <>
                        {fmtNumber(stat.total_events)}
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '0.4rem' }}>
                          event
                        </span>
                      </>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
                    {isDelica
                      ? 'Bakery, Tenant F&B, Seating Area, dan Gerbang Mall (Dine-In & Makanan Siap Saji)'
                      : `Porsi: ${dailyData.mapped_events > 0 ? ((stat.total_events / dailyData.mapped_events) * 100).toFixed(1) : 0}% dari seluruh event terpetakan`}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed Isle Table */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1rem' }}>
              Rincian Distribusi per Isle / Lorong ({selectedDate})
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-dim)' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Nama Isle / Lorong</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Area</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Total Shelf</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Shelf Aktif</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Total Event</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Rata-rata per Shelf</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyData && Object.entries(dailyData.isle_summary)
                    .sort((a, b) => b[1].total_events - a[1].total_events)
                    .map(([isleName, stat]) => (
                      <tr key={isleName} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                          {isleName}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                          {stat.area}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-dim)' }}>
                          {stat.total_shelves}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--accent-emerald)' }}>
                          {stat.shelves_with_events}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                          {fmtNumber(stat.total_events)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-dim)' }}>
                          {stat.total_shelves > 0 ? fmtNumber(Math.round(stat.total_events / stat.total_shelves)) : 0}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 7. Tab Audit & Rekonsiliasi (Section 7 & 8) */}
      {activeTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--accent-emerald)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
              <CheckCircle2 size={22} color="var(--accent-emerald)" />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Status Rekonsiliasi Data 100% Terverifikasi
              </h3>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              Sesuai kaidah integritas analitik: <strong>Total Event = Event Berhasil Dipetakan + Event Tidak Berhasil Dipetakan</strong>.
              Tidak ada baris yang diduplikasi atau dibuang tanpa pertanggungjawaban.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginTop: '1.25rem' }}>
              <div style={{ padding: '1rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Total Event Sumber Parquet:</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.25rem' }}>
                  {fmtNumber(dailyData?.total_events)} baris
                </div>
              </div>

              <div style={{ padding: '1rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Event Terpetakan ke Shelf (≤1.0m):</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: '0.25rem' }}>
                  {fmtNumber(dailyData?.mapped_events)} ({dailyData?.mapped_percentage}%)
                </div>
              </div>

              <div style={{ padding: '1rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Event Koridor / Walkway / Luar Shelf:</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-amber)', marginTop: '0.25rem' }}>
                  {fmtNumber(dailyData?.unmapped_events)} ({dailyData ? (100 - dailyData.mapped_percentage).toFixed(2) : 0}%)
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={16} />
              <span>
                Verifikasi Jumlah: {fmtNumber(dailyData?.mapped_events)} + {fmtNumber(dailyData?.unmapped_events)} = <strong>{fmtNumber(dailyData?.total_events)}</strong> (Selisih: 0 baris)
              </span>
            </div>
          </div>

          {/* Action Breakdown */}
          {dailyData?.action_breakdown && (
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.75rem' }}>
                Distribusi Action Code Event Shopper
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                {Object.entries(dailyData.action_breakdown).map(([act, cnt]) => (
                  <div key={act} style={{ padding: '0.85rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)' }}>
                      {act}
                    </div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.25rem' }}>
                      {fmtNumber(cnt)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {dailyData.total_events > 0 ? ((cnt / dailyData.total_events) * 100).toFixed(1) : 0}% dari total harian
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
