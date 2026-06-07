import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { fetchSource } from '../api/consoleApi';
import { StatusChip } from '../components/StatusChip';
import type { SourceDetail } from '../types';

interface GuardianLawnPanelProps {
  onOpen: (target: string) => void;
}

type Point = { x: number; y: number };
type HazardBox = { x1?: number; y1?: number; x2?: number; y2?: number; x?: number; y?: number; w?: number; h?: number; kind?: string };

type LawnOutlinePayload = {
  ok?: boolean;
  message?: string;
  current_boundary?: Point[];
  saved_boundary?: Point[];
  guard_boundary?: Point[];
  live_boundary?: Point[];
};

type LawnVisionPayload = {
  state?: string;
  attributes?: {
    hazard_boxes?: HazardBox[];
    when_utc?: string;
    ok?: boolean;
    block_mowing?: boolean | null;
    mowing_hazard_detected?: boolean | null;
    vision_preview_url?: string;
    vision_preview_annotation_applied?: boolean | null;
    vision_preview_box_count?: number | null;
    vision_preview_error?: string | null;
    confidence?: number | null;
    confidence_threshold?: number | null;
    scenario_id?: string;
    scenario_label?: string;
    frame_count?: number | null;
    model?: string;
  };
};

function normPoint(point: Point): Point {
  const x = Number(point.x || 0);
  const y = Number(point.y || 0);
  const max = Math.max(Math.abs(x), Math.abs(y));
  return max > 1.5 ? { x: x / 100, y: y / 100 } : { x, y };
}

function svgPoints(points: Point[]) {
  return points.map(normPoint).map(point => `${(point.x * 100).toFixed(2)},${(point.y * 100).toFixed(2)}`).join(' ');
}

function normBox(box: HazardBox) {
  if (box.x1 != null && box.y1 != null && box.x2 != null && box.y2 != null) {
    const max = Math.max(Math.abs(box.x1), Math.abs(box.y1), Math.abs(box.x2), Math.abs(box.y2));
    const div = max > 1.5 ? 100 : 1;
    return {
      x: Math.min(box.x1, box.x2) / div,
      y: Math.min(box.y1, box.y2) / div,
      w: Math.abs(box.x2 - box.x1) / div,
      h: Math.abs(box.y2 - box.y1) / div
    };
  }
  if (box.x != null && box.y != null && box.w != null && box.h != null) {
    const max = Math.max(Math.abs(box.x), Math.abs(box.y), Math.abs(box.w), Math.abs(box.h));
    const div = max > 1.5 ? 100 : 1;
    return { x: box.x / div, y: box.y / div, w: box.w / div, h: box.h / div };
  }
  return null;
}

function hazardTone(kind?: string) {
  if (kind === 'poo') return '#f0b84a';
  if (kind === 'dog') return '#59d7ff';
  if (kind === 'person') return '#a78bfa';
  return '#f26d6d';
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function ageLabel(whenUtc?: string) {
  if (!whenUtc) return 'no timestamp';
  const when = Date.parse(whenUtc);
  if (Number.isNaN(when)) return 'bad timestamp';
  const diffMs = Date.now() - when;
  if (diffMs < 0) return 'future';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 90) return `${minutes}m old`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h old`;
  return `${Math.floor(hours / 24)}d old`;
}

function frameFreshness(whenUtc?: string) {
  if (!whenUtc) return { label: 'frame missing timestamp', tone: 'warn', stale: true };
  const when = Date.parse(whenUtc);
  if (Number.isNaN(when)) return { label: 'frame timestamp invalid', tone: 'warn', stale: true };
  const diffMs = Date.now() - when;
  if (diffMs < 0) return { label: 'frame timestamp future', tone: 'warn', stale: true };
  const hours = diffMs / 3600000;
  if (hours >= 24) return { label: 'stale frame', tone: 'warn', stale: true };
  if (hours >= 2) return { label: 'aging frame', tone: 'warn', stale: false };
  return { label: 'fresh frame', tone: 'ok', stale: false };
}

function shortModel(model?: string) {
  if (!model) return '--';
  const base = model.split('/').pop() || model;
  return base.length > 28 ? `${base.slice(0, 25)}...` : base;
}

function eventPoint(event: ReactPointerEvent<SVGSVGElement> | ReactMouseEvent<SVGSVGElement>): Point {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: clamp01((event.clientX - rect.left) / Math.max(rect.width, 1)),
    y: clamp01((event.clientY - rect.top) / Math.max(rect.height, 1))
  };
}

async function fetchLawnSource<T>(target: string, attempts = 3): Promise<SourceDetail<T>> {
  let latest: SourceDetail<T> | null = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    latest = await fetchSource<T>(target, { loggerEvidence: false });
    if (latest.ok && latest.http_status === 200) return latest;
    await new Promise(resolve => window.setTimeout(resolve, 350 * attempt));
  }
  if (latest) return latest;
  throw new Error(`${target} source unavailable`);
}

export function GuardianLawnPanel({ onOpen }: GuardianLawnPanelProps) {
  const [outline, setOutline] = useState<SourceDetail<LawnOutlinePayload> | null>(null);
  const [vision, setVision] = useState<SourceDetail<LawnVisionPayload> | null>(null);
  const [previewPoints, setPreviewPoints] = useState<Point[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [previewDirty, setPreviewDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [outlineResult, snapshotResult] = await Promise.allSettled([
        fetchLawnSource<LawnOutlinePayload>('guardian_lawn_outline'),
        fetchLawnSource<LawnVisionPayload>('guardian_lawn_vision')
      ]);
      if (cancelled) return;
      setOutline(outlineResult.status === 'fulfilled' ? outlineResult.value : null);
      setVision(snapshotResult.status === 'fulfilled' ? snapshotResult.value : null);
    }
    load().catch(() => undefined);
    const timer = window.setInterval(() => load().catch(() => undefined), 20000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const boundary = outline?.payload?.saved_boundary || outline?.payload?.current_boundary || [];
  const guard = outline?.payload?.guard_boundary || [];
  const attrs = vision?.payload?.attributes || {};
  const hazards = attrs.hazard_boxes || [];
  const previewUrl = attrs.vision_preview_url || '';
  const previewAge = ageLabel(attrs.when_utc);
  const freshness = frameFreshness(attrs.when_utc);
  const annotationState = attrs.vision_preview_annotation_applied ? 'annotated' : 'not annotated';
  const previewBoxCount = attrs.vision_preview_box_count ?? hazards.length;
  const confidence = attrs.confidence == null ? '--' : `${Math.round(Number(attrs.confidence) * 100)}%`;
  const threshold = attrs.confidence_threshold == null ? '--' : `${Math.round(Number(attrs.confidence_threshold) * 100)}%`;
  const checks = [
    { ok: Boolean(outline?.ok) },
    { ok: Boolean(vision?.ok) },
    { ok: attrs.ok !== false }
  ];
  const okChecks = checks.filter(check => check.ok).length;

  const points = useMemo(() => boundary.map(normPoint), [boundary]);
  const state = outline?.ok && vision?.ok ? 'ok' : outline || vision ? 'degraded' : 'unavailable';

  useEffect(() => {
    if (!previewDirty) {
      setPreviewPoints(points);
      setSelectedIndex(null);
      setDragIndex(null);
    }
  }, [points, previewDirty]);

  function updatePreviewPoint(index: number, next: Point) {
    setPreviewPoints(current => current.map((point, currentIndex) => currentIndex === index ? next : point));
    setPreviewDirty(true);
  }

  function handlePreviewMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (dragIndex == null) return;
    event.preventDefault();
    updatePreviewPoint(dragIndex, eventPoint(event));
  }

  function handlePointDown(event: ReactPointerEvent<SVGCircleElement>, index: number) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedIndex(index);
    setDragIndex(index);
    setPreviewDirty(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePreviewUp() {
    setDragIndex(null);
  }

  function addPreviewPoint() {
    const anchor = selectedIndex != null ? previewPoints[selectedIndex] : previewPoints[previewPoints.length - 1];
    const next = anchor ? { x: clamp01(anchor.x + 0.035), y: clamp01(anchor.y + 0.035) } : { x: 0.5, y: 0.5 };
    const insertAt = selectedIndex == null ? previewPoints.length : selectedIndex + 1;
    const copy = [...previewPoints];
    copy.splice(insertAt, 0, next);
    setPreviewPoints(copy);
    setSelectedIndex(insertAt);
    setPreviewDirty(true);
  }

  function deletePreviewPoint() {
    if (selectedIndex == null || previewPoints.length <= 3) return;
    setPreviewPoints(current => current.filter((_, index) => index !== selectedIndex));
    setSelectedIndex(null);
    setPreviewDirty(true);
  }

  function resetPreview() {
    setPreviewPoints(points);
    setSelectedIndex(null);
    setDragIndex(null);
    setPreviewDirty(false);
  }

  return (
    <article className="ops-panel lawn-panel">
      <div className="ops-title">
        <div>
          <p className="eyebrow">Guardian Lawn</p>
          <h2>Camera Boundary + Hazard Vision</h2>
        </div>
        <div className="lawn-source-buttons">
          <button type="button" onClick={() => onOpen('guardian_lawn_outline')}>Boundary</button>
          <button type="button" onClick={() => onOpen('guardian_lawn_vision')}>Vision</button>
        </div>
      </div>
      <div className="lawn-stage">
        <div className="lawn-vision-stack">
          <div className="lawn-camera-strip" aria-label="Guardian lawn camera evidence">
            <div className={`lawn-camera-frame ${freshness.stale ? 'stale' : ''}`}>
              <span className="camera-scan-line" />
              <span className={`camera-target ${attrs.mowing_hazard_detected || freshness.stale ? 'warn' : 'ok'}`} />
              <strong>{attrs.scenario_label || vision?.payload?.state || 'waiting'}</strong>
              <small>{previewUrl ? 'owner frame reference present' : 'owner frame reference missing'}</small>
            </div>
            <div className="lawn-camera-readout">
              <div>
                <span>frame age</span>
                <strong>{previewAge}</strong>
              </div>
              <div>
                <span>annotation</span>
                <strong>{annotationState}</strong>
              </div>
              <div>
                <span>boxes</span>
                <strong>{previewBoxCount ?? '--'}</strong>
              </div>
              <div>
                <span>confidence</span>
                <strong>{confidence}/{threshold}</strong>
              </div>
              <div>
                <span>frames</span>
                <strong>{attrs.frame_count ?? '--'}</strong>
              </div>
              <div>
                <span>model</span>
                <strong>{shortModel(attrs.model)}</strong>
              </div>
            </div>
            <div className="chip-row">
              <span className={`router-chip ${attrs.vision_preview_error ? 'warn' : 'ok'}`}>{attrs.vision_preview_error ? 'preview error' : 'preview metadata ok'}</span>
              <span className={`router-chip ${freshness.tone}`}>{freshness.label}</span>
              <span className="router-chip warn">image proxy pending</span>
            </div>
          </div>
          <section
            className="lawn-image-contract-ledger"
            data-image-proxy-pending="true"
            data-direct-image-blocked="true"
            data-save-gated="true"
            data-owner-frame-ref={previewUrl ? 'present' : 'missing'}
          >
            <div className="panel-head">
              <div>
                <p className="eyebrow">Image Contract</p>
                <h3>Annotated Image Proxy Blocker</h3>
              </div>
              <button type="button" onClick={() => onOpen('guardian_lawn_vision')}>Vision Source</button>
            </div>
            <div className="lawn-image-contract-grid">
              <button className={`lawn-image-contract-card ${previewUrl ? 'ok' : 'warn'}`} type="button" onClick={() => onOpen('guardian_lawn_vision')}>
                <strong>owner frame reference</strong>
                <span>{previewUrl ? 'present' : 'missing'}</span>
                <small>{previewUrl || 'Guardian frame URL unavailable'}</small>
                <em>{annotationState} · {previewBoxCount ?? '--'} boxes</em>
              </button>
              <button className="lawn-image-contract-card warn" type="button" onClick={() => onOpen('guardian_lawn_vision')}>
                <strong>Bus image proxy</strong>
                <span>proxy route pending</span>
                <small>Guardian Bus route required before pixels render</small>
                <em>metadata-only evidence now</em>
              </button>
              <button className="lawn-image-contract-card ok" type="button" onClick={() => onOpen('guardian_lawn_vision')}>
                <strong>direct browser image</strong>
                <span>blocked by policy</span>
                <small>no /local owner image request from Console</small>
                <em>Amber Bus-only data plane</em>
              </button>
              <button className="lawn-image-contract-card warn" type="button" onClick={() => onOpen('guardian_lawn_outline')}>
                <strong>save and rollback</strong>
                <span>owner save gated</span>
                <small>preview, confirmation, rollback, and proof required</small>
                <em>local preview only</em>
              </button>
            </div>
          </section>
          <div className="lawn-canvas" role="img" aria-label="Guardian lawn boundary preview">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              onPointerMove={handlePreviewMove}
              onPointerUp={handlePreviewUp}
              onPointerLeave={handlePreviewUp}
            >
              <defs>
                <pattern id="lawnGrid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#2f3b4a" strokeWidth="0.35" />
                </pattern>
              </defs>
              <rect width="100" height="100" fill="url(#lawnGrid)" />
              {guard.length >= 3 && <polygon points={svgPoints(guard)} className="guard-boundary" />}
              {points.length >= 3 && <polygon points={svgPoints(points)} className="saved-boundary" />}
              {previewPoints.length >= 3 && <polygon points={svgPoints(previewPoints)} className="preview-boundary" />}
              {previewPoints.map((point, index) => (
                <circle
                  key={`${point.x}-${point.y}-${index}`}
                  cx={point.x * 100}
                  cy={point.y * 100}
                  r={selectedIndex === index ? '2.1' : '1.55'}
                  className={`boundary-point preview-boundary-point ${selectedIndex === index ? 'selected' : ''}`}
                  onPointerDown={event => handlePointDown(event, index)}
                />
              ))}
              {hazards.map((box, index) => {
                const b = normBox(box);
                if (!b) return null;
                return (
                  <rect
                    key={`${box.kind || 'hazard'}-${index}`}
                    x={b.x * 100}
                    y={b.y * 100}
                    width={b.w * 100}
                    height={b.h * 100}
                    fill="none"
                    stroke={hazardTone(box.kind)}
                    strokeWidth="1.5"
                  />
                );
              })}
            </svg>
          </div>
        </div>
        <div className="lawn-readout">
          <StatusChip state={state} />
          <div className="lawn-metric">
            <strong>{boundary.length || '--'}</strong>
            <span>owner boundary points</span>
          </div>
          <div className="lawn-metric">
            <strong>{previewPoints.length || '--'}</strong>
            <span>preview points</span>
          </div>
          <div className="lawn-metric">
            <strong>{hazards.length}</strong>
            <span>hazard boxes</span>
          </div>
          <div className="lawn-metric">
            <strong>{okChecks}/{checks.length || '--'}</strong>
            <span>vision checks</span>
          </div>
          <p>{vision?.payload?.state || outline?.payload?.message || 'waiting for Guardian lawn evidence'}</p>
          <div className="lawn-preview-actions">
            <button type="button" onClick={addPreviewPoint}>Add point</button>
            <button type="button" onClick={deletePreviewPoint} disabled={selectedIndex == null || previewPoints.length <= 3}>Delete point</button>
            <button type="button" onClick={resetPreview} disabled={!previewDirty}>Reset preview</button>
            <button type="button" disabled>Save gated</button>
          </div>
          <div className="chip-row">
            <span className={`router-chip ${previewDirty ? 'warn' : 'ok'}`}>preview {previewDirty ? 'changed' : 'matches owner'}</span>
            <span className="router-chip warn">owner save gated</span>
            <span className={`router-chip ${attrs.block_mowing ? 'hot' : 'ok'}`}>mow block {attrs.block_mowing ? 'on' : 'off/clear'}</span>
            <span className={`router-chip ${attrs.mowing_hazard_detected ? 'warn' : 'ok'}`}>hazard {attrs.mowing_hazard_detected ? 'seen' : 'clear'}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
