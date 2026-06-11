import { useEffect, useMemo, useState } from 'react';
import { fetchSource } from '../api/consoleApi';
import { MetricRow } from '../components/MetricRow';
import { StatusChip } from '../components/StatusChip';
import type { SourceDetail, SourceState } from '../types';

interface ProxmoxManagerPanelProps {
  onOpen: (target: string) => void;
}

type ProxmoxRecommendation = {
  host_ref?: string;
  guest_ref?: string;
  status?: string;
  risk_classification?: string;
  reason?: string;
  upgrade_packages?: string[];
  memorr_context_refs?: string[];
  veliai_analysis_required?: boolean;
  mutation_attempted?: boolean;
};

type ProxmoxManagerStatus = {
  ok?: boolean;
  service_state?: string;
  lifecycle_mode?: string;
  mutation_enabled?: boolean;
  readonly_soak_safe?: boolean;
  operator_apply_go?: boolean;
  operator_apply_block_reason?: string;
  direct_console_to_proxmox_allowed?: boolean;
  veliai_live_dispatch_enabled?: boolean;
  memorr_live_ingest_enabled?: boolean;
  logger_live_spool_enabled?: boolean;
  summary?: {
    breakable_count?: number;
    upgrade_delta_count?: number;
    would_do_count?: number;
    would_block_count?: number;
    cannot_judge_count?: number;
    veliai_analysis_request_count?: number;
    memorr_memory_event_count?: number;
    backup_guest_count?: number;
    custody_secure_guest_count?: number;
    restore_ready_guest_count?: number;
    backup_cannot_judge_guest_count?: number;
  };
  memorr?: {
    target_function?: string;
    stream_class?: string;
    ai_surface_allowed?: boolean;
    raw_payload_allowed?: boolean;
    direct_db_allowed?: boolean;
  };
  veliai?: {
    target_function?: string;
    analysis_kind?: string;
    bounded_context_only?: boolean;
    raw_package_inventory_included?: boolean;
    provider_selection_allowed?: boolean;
    model_selection_allowed?: boolean;
    apply_authority?: boolean;
  };
  logger?: {
    sink_owner?: string;
    event_ref?: string;
    live_spool_enabled?: boolean;
  };
  recommendations?: ProxmoxRecommendation[];
};

function tone(payload?: ProxmoxManagerStatus, source?: SourceDetail<ProxmoxManagerStatus> | null): SourceState {
  if (!source || !source.ok) return 'unavailable';
  if (payload?.service_state === 'ok' && payload?.readonly_soak_safe) return 'ok';
  return 'degraded';
}

function short(value?: string, fallback = '--', length = 58) {
  if (!value) return fallback;
  return value.length > length ? `${value.slice(0, length - 3)}...` : value;
}

export function ProxmoxManagerPanel({ onOpen }: ProxmoxManagerPanelProps) {
  const [source, setSource] = useState<SourceDetail<ProxmoxManagerStatus> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTick, setLastTick] = useState('--');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const next = await fetchSource<ProxmoxManagerStatus>('proxmox_manager', { loggerEvidence: false });
        if (cancelled) return;
        setSource(next);
        setError(null);
        setLastTick(new Date().toLocaleTimeString());
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

  const payload = source?.payload;
  const summary = payload?.summary || {};
  const recommendations = payload?.recommendations || [];
  const blocked = useMemo(() => recommendations.filter(item => item.status === 'blocked' || item.status === 'cannot_judge'), [recommendations]);
  const state = tone(payload, source);
  const aiReady = Boolean(payload?.memorr?.ai_surface_allowed && payload?.veliai?.bounded_context_only && payload?.veliai?.apply_authority === false);

  return (
    <section className="panel wide proxmox-manager-panel">
      <div className="proxmox-manager-head">
        <div>
          <p className="eyebrow">Amber Proxmox Manager</p>
          <h2>Read-only Soak</h2>
        </div>
        <div className="statusbar">
          <StatusChip state={state} label={payload?.lifecycle_mode || 'loading'} />
          <button type="button" onClick={() => onOpen('proxmox_manager')}>Evidence</button>
        </div>
      </div>

      <div className="proxmox-soak-stage">
        <section className={payload?.mutation_enabled ? 'danger' : 'safe'}>
          <span>mutation</span>
          <b>{payload?.mutation_enabled ? 'enabled' : 'blocked'}</b>
          <small>{payload?.operator_apply_go ? 'operator apply open' : payload?.operator_apply_block_reason || 'read-only gate active'}</small>
        </section>
        <section className={aiReady ? 'safe' : 'warn'}>
          <span>AI analysis</span>
          <b>{summary.veliai_analysis_request_count ?? '--'} requests</b>
          <small>{payload?.veliai?.target_function || 'veliai queue pending'}</small>
        </section>
        <section className={payload?.memorr?.ai_surface_allowed ? 'safe' : 'warn'}>
          <span>Memorr surface</span>
          <b>{summary.memorr_memory_event_count ?? '--'} memories</b>
          <small>{payload?.memorr?.stream_class || 'memory stream pending'}</small>
        </section>
        <section className={summary.backup_cannot_judge_guest_count ? 'warn' : 'safe'}>
          <span>custody</span>
          <b>{summary.custody_secure_guest_count ?? '--'}/{summary.backup_guest_count ?? '--'}</b>
          <small>{summary.backup_cannot_judge_guest_count ?? 0} cannot judge</small>
        </section>
      </div>

      <div className="proxmox-manager-grid">
        <section className="proxmox-metrics">
          <MetricRow label="breakables" value={summary.breakable_count ?? '--'} />
          <MetricRow label="apt deltas" value={summary.upgrade_delta_count ?? '--'} />
          <MetricRow label="would do" value={summary.would_do_count ?? '--'} />
          <MetricRow label="would block" value={summary.would_block_count ?? '--'} />
          <MetricRow label="cannot judge" value={summary.cannot_judge_count ?? '--'} />
          <MetricRow label="restore ready" value={summary.restore_ready_guest_count ?? '--'} />
        </section>

        <section className="proxmox-contract-ledger">
          <button type="button" className={payload?.direct_console_to_proxmox_allowed ? 'warn' : 'ok'} onClick={() => onOpen('proxmox_manager')}>
            <b>Console data plane</b>
            <span>{payload?.direct_console_to_proxmox_allowed ? 'direct Proxmox call' : 'Amber Bus only'}</span>
          </button>
          <button type="button" className={payload?.memorr?.direct_db_allowed ? 'warn' : 'ok'} onClick={() => onOpen('proxmox_manager')}>
            <b>Memorr boundary</b>
            <span>{payload?.memorr?.direct_db_allowed ? 'direct DB read' : payload?.memorr?.target_function || 'memory lifecycle'}</span>
          </button>
          <button type="button" className={payload?.veliai?.apply_authority ? 'warn' : 'ok'} onClick={() => onOpen('proxmox_manager')}>
            <b>Veliai authority</b>
            <span>{payload?.veliai?.apply_authority ? 'apply authority present' : 'analysis only'}</span>
          </button>
          <button type="button" className={payload?.logger_live_spool_enabled ? 'ok' : 'warn'} onClick={() => onOpen('proxmox_manager')}>
            <b>Logger</b>
            <span>{payload?.logger?.live_spool_enabled ? 'live spool' : short(payload?.logger?.event_ref, 'spool pending')}</span>
          </button>
        </section>

        <section className="proxmox-risk-list">
          <div className="proxmox-section-title">
            <h3>Upgrade Decisions</h3>
            <StatusChip state={blocked.length ? 'degraded' : 'ok'} label={`${blocked.length} gated`} />
          </div>
          {recommendations.map((item, index) => (
            <button key={`${item.host_ref || 'host'}-${item.guest_ref || index}`} type="button" onClick={() => onOpen('proxmox_manager')}>
              <StatusChip state={item.status === 'safe_to_propose' ? 'ok' : 'degraded'} label={item.status || 'unknown'} />
              <b>{item.guest_ref || item.host_ref || 'Proxmox scope'}</b>
              <span>{short((item.upgrade_packages || []).join(', '), 'no package delta', 72)}</span>
              <small>{item.reason || item.risk_classification || 'evidence pending'}</small>
            </button>
          ))}
        </section>
      </div>

      <div className="proxmox-foot">
        <span>last {lastTick}</span>
        <span>{source?.data_plane || 'amber_bus_only'}</span>
        <span>{error || source?.url || 'source pending'}</span>
      </div>
    </section>
  );
}
