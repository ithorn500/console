import { useEffect, useState } from 'react';
import { fetchSource } from '../api/consoleApi';
import { StatusChip } from '../components/StatusChip';
import type { SourceDetail } from '../types';

interface ActorrOpsPanelProps {
  onOpen: (target: string) => void;
}

type OpsTarget = {
  id: string;
  label: string;
  role: string;
};

const targets: OpsTarget[] = [
  { id: 'actorr_operator_snapshot', label: 'Actorr', role: 'operator media surface' },
  { id: 'guardian_c2_snapshot', label: 'Guardian', role: 'C2 apply surface' },
  { id: 'logger_ops_dashboard', label: 'Logger', role: 'incident and pulse surface' }
];

function payloadSize(detail: SourceDetail<Record<string, unknown>> | null) {
  if (!detail?.payload || typeof detail.payload !== 'object') return 0;
  return Object.keys(detail.payload).length;
}

function metric(detail: SourceDetail<Record<string, unknown>> | null) {
  if (!detail) return '--';
  if (!detail.ok) return detail.http_status || 'down';
  return payloadSize(detail) || 'live';
}

function preview(detail: SourceDetail<Record<string, unknown>> | null) {
  if (!detail) return 'waiting for Bus evidence';
  if (!detail.ok) return detail.error || 'Bus contract did not return data';
  return JSON.stringify(detail.payload).slice(0, 130);
}

export function ActorrOpsPanel({ onOpen }: ActorrOpsPanelProps) {
  const [sources, setSources] = useState<Record<string, SourceDetail<Record<string, unknown>> | null>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const results = await Promise.allSettled(targets.map(target => fetchSource<Record<string, unknown>>(target.id, { loggerEvidence: false })));
      if (cancelled) return;
      const next: Record<string, SourceDetail<Record<string, unknown>> | null> = {};
      targets.forEach((target, index) => {
        const result = results[index];
        next[target.id] = result.status === 'fulfilled' ? result.value : null;
      });
      setSources(next);
    }
    load().catch(() => undefined);
    const timer = window.setInterval(() => load().catch(() => undefined), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <article className="ops-panel ops-radar-panel">
      <div className="ops-title">
        <div>
          <p className="eyebrow">C2 / Ops</p>
          <h2>Actorr-grade Surfaces</h2>
        </div>
        <span className="hint">Amber Bus contracts only</span>
      </div>
      <div className="ops-radar">
        {targets.map((target, index) => {
          const detail = sources[target.id] || null;
          const state = detail?.ok ? 'ok' : detail ? 'unavailable' : 'degraded';
          return (
            <button
              className={`ops-radar-node tone-${index}`}
              type="button"
              key={target.id}
              onClick={() => onOpen(target.id)}
            >
              <StatusChip state={state} />
              <strong>{metric(detail)}</strong>
              <span>{target.label}</span>
              <small>{target.role}</small>
              <p>{preview(detail)}</p>
            </button>
          );
        })}
      </div>
    </article>
  );
}
