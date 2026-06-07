import { useEffect, useMemo, useState } from 'react';
import { fetchSource } from '../api/consoleApi';
import { StatusChip } from '../components/StatusChip';
import type { SourceDetail } from '../types';

interface GuardianC2DrilldownPanelProps {
  onOpen: (target: string) => void;
}

type Plane = {
  title?: string;
  parent?: string;
  parent_title?: string;
  status?: string;
  metrics?: Record<string, unknown>;
  faults?: unknown[];
  impact?: string;
  actions?: unknown[];
};

type ZoomItem = {
  id?: string;
  label?: string;
  function?: string;
  source?: string;
  status?: string;
  section?: Record<string, unknown>;
};

type GuardianC2Payload = {
  generated_at_utc?: string;
  surfaces?: Record<string, string>;
  planes?: Record<string, Plane>;
  chain_sections?: Record<string, unknown>;
  zoom?: Record<string, ZoomItem[]>;
  drilldown?: Record<string, Record<string, unknown>>;
};

function payloadObject(payload: unknown): GuardianC2Payload | null {
  return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as GuardianC2Payload : null;
}

function short(value: unknown, fallback = '--') {
  if (value === null || value === undefined || value === '') return fallback;
  const text = String(value);
  return text.length > 76 ? `${text.slice(0, 73)}...` : text;
}

function tone(status?: string) {
  if (status === 'ok' || status === 'pass' || status === 'complete') return 'ok';
  if (status === 'alert' || status === 'fault' || status === 'error' || status === 'hard_fail') return 'degraded';
  return 'unavailable';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function summaryValue(value: unknown) {
  if (Array.isArray(value)) return value.length;
  if (isObject(value)) {
    if (typeof value.ok === 'boolean') return value.ok ? 'ok' : 'not ok';
    if (typeof value.status === 'string') return value.status;
    return Object.keys(value).length;
  }
  return short(value);
}

export function GuardianC2DrilldownPanel({ onOpen }: GuardianC2DrilldownPanelProps) {
  const [detail, setDetail] = useState<SourceDetail<GuardianC2Payload | string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const next = await fetchSource<GuardianC2Payload | string>('guardian_c2_snapshot', { loggerEvidence: false });
      if (!cancelled) setDetail(next);
    }
    load().catch(() => undefined);
    const timer = window.setInterval(() => load().catch(() => undefined), 90000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const payload = payloadObject(detail?.payload);
  const planes = useMemo(() => Object.entries(payload?.planes || {}), [payload]);
  const alertPlanes = planes.filter(([, plane]) => plane.status && plane.status !== 'ok');
  const zoomGroups = useMemo(() => Object.entries(payload?.zoom || {}), [payload]);
  const drilldowns = useMemo(() => Object.entries(payload?.drilldown || {}), [payload]);
  const surfaces = useMemo(() => Object.entries(payload?.surfaces || {}), [payload]);
  const omegaZoom = payload?.zoom?.omega || [];
  const applyEvidence = omegaZoom
    .flatMap(item => {
      const section = item.section;
      const direct = isObject(section) && Array.isArray(section.apply_evidence) ? section.apply_evidence : [];
      const pointer = isObject(section) && isObject(section.bus_logger_evidence) ? [section.bus_logger_evidence] : [];
      return [...direct, ...pointer];
    });
  const state = detail?.ok && payload ? 'ok' : detail ? 'degraded' : 'unavailable';

  return (
    <article className="ops-panel guardian-drilldown-panel">
      <div className="ops-title">
        <div>
          <p className="eyebrow">Guardian C2 Depth</p>
          <h2>Tab Families, Drilldowns, and Apply Evidence</h2>
        </div>
        <button type="button" onClick={() => onOpen('guardian_c2_snapshot')}>C2 Snapshot</button>
      </div>

      <div className="guardian-depth-headline">
        <button type="button" onClick={() => onOpen('guardian_c2_snapshot')}>
          <StatusChip state={state} />
          <strong>{planes.length || '--'}</strong>
          <span>planes</span>
          <small>{alertPlanes.length} alert/fault planes</small>
        </button>
        <button type="button" onClick={() => onOpen('guardian_c2_snapshot')}>
          <strong>{zoomGroups.length || '--'}</strong>
          <span>zoom groups</span>
          <small>{zoomGroups.reduce((sum, [, rows]) => sum + rows.length, 0)} evidence rows</small>
        </button>
        <button type="button" onClick={() => onOpen('guardian_c2_snapshot')}>
          <strong>{drilldowns.length || '--'}</strong>
          <span>drilldowns</span>
          <small>{Object.keys(payload?.chain_sections || {}).length} chain sections</small>
        </button>
        <button type="button" onClick={() => onOpen('guardian_c2_snapshot')}>
          <strong>{applyEvidence.length || '--'}</strong>
          <span>apply evidence</span>
          <small>read-only, no execute controls</small>
        </button>
      </div>

      <div className="guardian-plane-grid">
        {planes.slice(0, 16).map(([id, plane]) => (
          <button type="button" key={id} onClick={() => onOpen('guardian_c2_snapshot')}>
            <StatusChip state={tone(plane.status)} label={short(plane.status, 'unknown')} />
            <strong>{plane.title || id}</strong>
            <span>{plane.parent_title || plane.parent || 'root plane'}</span>
            <small>{short(plane.impact || `${Object.keys(plane.metrics || {}).length} metrics`)}</small>
          </button>
        ))}
      </div>

      <div className="guardian-depth-split">
        <section>
          <h3>Zoom Evidence</h3>
          {zoomGroups.slice(0, 8).map(([group, rows]) => (
            <button type="button" key={group} onClick={() => onOpen('guardian_c2_snapshot')}>
              <strong>{group}</strong>
              <span>{rows.length} rows</span>
              <small>{rows.slice(0, 2).map(row => row.label || row.id).join(' | ') || 'no labels'}</small>
            </button>
          ))}
        </section>
        <section>
          <h3>Drilldown Contracts</h3>
          {drilldowns.slice(0, 10).map(([id, value]) => (
            <button type="button" key={id} onClick={() => onOpen('guardian_c2_snapshot')}>
              <strong>{id}</strong>
              <span>{Object.keys(value).length} fields</span>
              <small>{Object.entries(value).slice(0, 3).map(([k, v]) => `${k}:${summaryValue(v)}`).join(' | ')}</small>
            </button>
          ))}
        </section>
      </div>

      <div className="guardian-surface-strip">
        {surfaces.slice(0, 8).map(([name, path]) => (
          <button type="button" key={name} onClick={() => onOpen('guardian_c2_snapshot')}>
            <strong>{name}</strong>
            <span>{short(path)}</span>
          </button>
        ))}
      </div>
    </article>
  );
}
