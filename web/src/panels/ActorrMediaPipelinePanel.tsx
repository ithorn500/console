import { useEffect, useState } from 'react';
import { fetchSource } from '../api/consoleApi';
import { MetricRow } from '../components/MetricRow';
import { StatusChip } from '../components/StatusChip';
import type { SourceDetail } from '../types';

interface ActorrMediaPipelinePanelProps {
  onOpen: (target: string) => void;
}

interface ActorrSnapshotPayload {
  schema?: string;
  ok?: boolean;
  when_utc?: string;
  snapshot?: {
    updated_at?: string;
    host?: Record<string, number>;
    provider_connectivity?: Record<string, unknown>;
    provider_slots?: Record<string, unknown>;
    relay?: Record<string, unknown>;
    veloxd?: Record<string, unknown>;
    velox_pipeline?: Record<string, unknown>;
    ingest_ring_cache?: Record<string, unknown>;
    output_ring_cache?: Record<string, unknown>;
    path_load?: Record<string, unknown>;
    throughput?: Record<string, unknown>;
    runtime_diagnostics?: {
      ok?: boolean;
      items?: Array<Record<string, unknown>>;
    };
    provider_first_byte?: {
      ok?: boolean;
      avg_ms?: number;
      slow_over_5s?: number;
      slow_over_15s?: number;
      last5?: Array<Record<string, unknown>>;
    };
    velox_dashboard?: {
      system?: {
        label?: string;
        state?: string;
        detail?: string;
      };
      metrics?: Record<string, unknown>;
      media_stack?: Record<string, unknown>;
      cache?: Record<string, unknown>;
      diagnostics?: Array<Record<string, unknown>>;
    };
  };
}

interface ActorrClientBootstrapPayload {
  ok?: boolean;
  enabled?: boolean;
  auto_update?: boolean;
  update_mandatory?: boolean;
  release_channel?: string;
  latest_version?: string;
  plex_compatibility_enabled?: boolean;
  linux_command?: string;
  windows_command?: string;
  linux_artifact_url?: string;
  windows_artifact_url?: string;
  runtime?: {
    mode?: string;
    linux_components?: string[];
    windows_components?: string[];
  };
  summary?: {
    total_events?: number;
    install_success?: number;
    update_success?: number;
    rollback?: number;
    version_drift?: number;
    latest_event?: Record<string, unknown>;
  };
}

function short(value: unknown, fallback = '--') {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function numberLabel(value: unknown, suffix = '') {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--';
  return `${value.toFixed(value >= 10 ? 0 : 1)}${suffix}`;
}

function stateTone(state?: string) {
  if (state === 'optimal' || state === 'ok' || state === 'ready') return 'ok';
  if (state === 'bypass_risk' || state === 'elevated') return 'degraded';
  return 'degraded';
}

export function ActorrMediaPipelinePanel({ onOpen }: ActorrMediaPipelinePanelProps) {
  const [source, setSource] = useState<SourceDetail<ActorrSnapshotPayload> | null>(null);
  const [clientSource, setClientSource] = useState<SourceDetail<ActorrClientBootstrapPayload> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [next, client] = await Promise.all([
          fetchSource<ActorrSnapshotPayload>('actorr_operator_snapshot', { loggerEvidence: false }),
          fetchSource<ActorrClientBootstrapPayload>('actorr_client_bootstrap', { loggerEvidence: false })
        ]);
        if (cancelled) return;
        setSource(next);
        setClientSource(client);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }
    load();
    const timer = window.setInterval(load, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const snapshot = source?.payload?.snapshot;
  const dashboard = snapshot?.velox_dashboard;
  const system = dashboard?.system;
  const metrics = dashboard?.metrics || {};
  const host = snapshot?.host || {};
  const slots = (snapshot?.provider_slots || snapshot?.relay?.provider_slots || {}) as Record<string, unknown>;
  const connectivity = snapshot?.provider_connectivity || {};
  const veloxd = snapshot?.veloxd || {};
  const ingest = snapshot?.ingest_ring_cache || {};
  const output = snapshot?.output_ring_cache || {};
  const pathLoad = snapshot?.path_load || {};
  const diagnostics = snapshot?.runtime_diagnostics?.items || dashboard?.diagnostics || [];
  const firstByte = snapshot?.provider_first_byte || {};
  const client = clientSource?.payload;
  const clientSummary = client?.summary || {};
  const latestClientEvent = clientSummary.latest_event || {};
  const healthDetail = system?.detail || (source?.ok
    ? 'Actorr owner snapshot live through Amber Bus.'
    : 'Waiting for Actorr operator snapshot through Amber Bus.');
  const pipelineSteps = [
    { id: 'provider', label: 'Provider', metric: short(connectivity.label || connectivity.state), note: short(connectivity.detail, 'connectivity evidence') },
    { id: 'ingest', label: 'Ingest Rings', metric: short(ingest.ring_count, '0'), note: `${short(ingest.hot_bytes, '0')} hot bytes` },
    { id: 'direct', label: 'Direct / Copy', metric: short(pathLoad.copy_n, '0'), note: `direct ${short(pathLoad.direct_pct)}%` },
    { id: 'transcode', label: 'Transcode', metric: short(pathLoad.encode_n, '0'), note: `transcode ${short(pathLoad.transcode_pct)}%` },
    { id: 'output', label: 'Output Cache', metric: short(output.ring_count, '0'), note: `${short(output.hot_bytes, '0')} hot bytes` },
    { id: 'client', label: 'Clients', metric: short(metrics.sessions || snapshot?.relay?.active_streaming_sessions, '0'), note: `${short(slots.available)} slots free` }
  ];

  return (
    <article className="panel wide actorr-media-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Actorr</p>
          <h2>Velox Media Pipeline and Operator Evidence</h2>
        </div>
        <button type="button" onClick={() => onOpen('actorr_operator_snapshot')}>Snapshot</button>
      </div>

      {error && <div className="router-error">{error}</div>}

      <div className="actorr-health-strip">
        <StatusChip state={source?.ok ? stateTone(system?.state) : 'degraded'} label={system?.label || (source?.ok ? 'live' : 'waiting')} />
        <span>{healthDetail}</span>
        <b>{snapshot?.updated_at || source?.payload?.when_utc || '--'}</b>
      </div>

      <div className="actorr-metric-grid">
        <button type="button" onClick={() => onOpen('actorr_operator_snapshot')}>
          <strong>{short(metrics.sessions || snapshot?.relay?.active_streaming_sessions, '0')}</strong>
          <span>sessions</span>
        </button>
        <button type="button" onClick={() => onOpen('actorr_operator_snapshot')}>
          <strong>{short(slots.available, '--')}/{short(slots.max, '--')}</strong>
          <span>provider slots</span>
        </button>
        <button type="button" onClick={() => onOpen('actorr_operator_snapshot')}>
          <strong>{short(firstByte.avg_ms, '--')}</strong>
          <span>avg first byte ms</span>
        </button>
        <button type="button" onClick={() => onOpen('actorr_operator_snapshot')}>
          <strong>{numberLabel(host.cpu_percent, '%')}</strong>
          <span>host CPU</span>
        </button>
        <button type="button" onClick={() => onOpen('actorr_operator_snapshot')}>
          <strong>{numberLabel(host.memory_used_pct, '%')}</strong>
          <span>memory used</span>
        </button>
        <button type="button" onClick={() => onOpen('actorr_operator_snapshot')}>
          <strong>{diagnostics.length}</strong>
          <span>diagnostics</span>
        </button>
      </div>

      <div className="actorr-pipeline-track">
        {pipelineSteps.map((step, index) => (
          <div className="actorr-pipeline-step" key={step.id}>
            <button type="button" className={`actorr-pipeline-node tone-${index}`} onClick={() => onOpen('actorr_operator_snapshot')}>
              <strong>{step.metric}</strong>
              <span>{step.label}</span>
              <small>{step.note}</small>
            </button>
            {index < pipelineSteps.length - 1 && <i className="actorr-pipeline-edge" />}
          </div>
        ))}
      </div>

      <div className="actorr-detail-grid">
        <section className="actorr-detail-card actorr-client-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Client Bootstrap</p>
              <h3>Install, update, and service package proof</h3>
            </div>
            <StatusChip state={clientSource?.ok && client?.ok ? 'ok' : 'degraded'} label={client?.enabled ? 'enabled' : 'waiting'} />
          </div>
          <div className="actorr-client-proof">
            <button type="button" onClick={() => onOpen('actorr_client_bootstrap')}>
              <strong>{short(client?.latest_version)}</strong>
              <span>latest stable client</span>
            </button>
            <button type="button" onClick={() => onOpen('actorr_client_bootstrap')}>
              <strong>{short(clientSummary.install_success, '0')}</strong>
              <span>install success</span>
            </button>
            <button type="button" onClick={() => onOpen('actorr_client_bootstrap')}>
              <strong>{short(clientSummary.update_success, '0')}</strong>
              <span>update success</span>
            </button>
            <button type="button" onClick={() => onOpen('actorr_client_bootstrap')}>
              <strong>{short(clientSummary.version_drift, '0')}</strong>
              <span>version drift</span>
            </button>
          </div>
          <MetricRow label="release channel" value={short(client?.release_channel)} />
          <MetricRow label="runtime mode" value={short(client?.runtime?.mode)} />
          <MetricRow label="linux components" value={short(client?.runtime?.linux_components?.length, '0')} />
          <MetricRow label="windows components" value={short(client?.runtime?.windows_components?.length, '0')} />
          <div className="actorr-client-install-strip">
            <button type="button" onClick={() => onOpen('actorr_client_bootstrap')}>
              <b>Linux</b>
              <span>{short(client?.linux_artifact_url || client?.linux_command)}</span>
            </button>
            <button type="button" onClick={() => onOpen('actorr_client_bootstrap')}>
              <b>Windows</b>
              <span>{short(client?.windows_artifact_url || client?.windows_command)}</span>
            </button>
          </div>
          <p className="hint">
            Last telemetry: {short(latestClientEvent.event)} / {short(latestClientEvent.platform)} / {short(latestClientEvent.version)}
          </p>
        </section>

        <section className="actorr-detail-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Runtime</p>
              <h3>Velox manager and Bus client</h3>
            </div>
            <StatusChip state={veloxd.ready ? 'ok' : 'degraded'} label={veloxd.ready ? 'ready' : 'not ready'} />
          </div>
          <MetricRow label="architecture" value={short(veloxd.architecture_mode)} />
          <MetricRow label="latency" value={`${short(veloxd.latency_ms)} ms`} />
          <MetricRow label="session count" value={short(veloxd.session_count, '0')} />
          <MetricRow label="VPN/bind state" value={short(connectivity.state)} />
        </section>

        <section className="actorr-detail-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Diagnostics</p>
              <h3>Recent native path events</h3>
            </div>
            <StatusChip state={diagnostics.length ? 'degraded' : 'ok'} label={diagnostics.length ? `${diagnostics.length} events` : 'clear'} />
          </div>
          <div className="actorr-diagnostic-list">
            {diagnostics.slice(0, 5).map((item, index) => (
              <button type="button" key={`${short(item.updated_at)}-${index}`} onClick={() => onOpen('actorr_operator_snapshot')}>
                <b>{short(item.level || item.category || 'event')}</b>
                <span>{short(item.message || item.title || item.playback_context_id)}</span>
              </button>
            ))}
            {!diagnostics.length && <div className="logger-empty">No recent Actorr diagnostics in the snapshot.</div>}
          </div>
        </section>
      </div>
    </article>
  );
}
