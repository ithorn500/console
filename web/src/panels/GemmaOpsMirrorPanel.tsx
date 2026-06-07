import { useEffect, useMemo, useState } from 'react';
import { fetchSource } from '../api/consoleApi';
import { LoggerCorrelationProofStrip } from '../components/LoggerCorrelationProofStrip';
import { MetricRow } from '../components/MetricRow';
import { StatusChip } from '../components/StatusChip';
import type { GemmaLanesPayload, HardwarePayload, SourceDetail, VeliaiUsagePayload } from '../types';

interface GemmaOpsMirrorPanelProps {
  onOpen: (target: string) => void;
}

type Worker = {
  handle?: string;
  port?: number;
  state?: string;
  pid?: number;
  restarts?: number;
  healthy?: boolean;
  binary_path?: string;
  model_path?: string;
  device?: string;
  engine?: string;
  mmproj?: {
    active?: boolean;
    status?: string;
    execution_provider?: string;
    policy_device?: string;
  };
};

type ActivityPayload = {
  emitted_at?: string;
  engine?: Record<string, unknown>;
  veliai_manager?: {
    available?: boolean;
    facade?: string;
    gemma_engine_version?: string;
    native_routes_registered?: boolean;
    central_log?: unknown;
  };
  local_llm_queue?: {
    state?: string;
    waiting?: number;
    in_flight?: number;
    max_concurrency?: number;
    queue_limit?: number;
    guardian_tasks_pending?: number;
    guardian_tasks_running?: number;
    guardian_tasks_failed?: number;
  };
  guardian_tasks?: Record<string, unknown>;
  compat_listen_recent?: unknown[];
  chat_completions_recent?: unknown[];
};

type OpsStatePayload = {
  state?: string;
  backend?: string;
  loaded_backend?: string;
  can_switch_backend?: boolean;
  veliai_manager?: {
    available?: boolean;
    native_routes_registered?: boolean;
  };
};

type ModelsPayload = {
  workers?: Worker[];
};

function short(value: unknown, fallback = '--') {
  if (value === null || value === undefined || value === '') return fallback;
  const text = String(value);
  return text.length > 70 ? `${text.slice(0, 67)}...` : text;
}

function amdMetric(raw: string | undefined, label: string) {
  if (!raw) return '--';
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = raw.match(new RegExp(`${escaped}.*?:\\s*([0-9.]+)`, 'i'));
  return match?.[1] || '--';
}

function stateFor(healthy?: boolean, state?: string) {
  if (healthy === true || state === 'healthy' || state === 'closed') return 'ok';
  if (healthy === false || state === 'failed' || state === 'open') return 'degraded';
  return state || 'unknown';
}

export function GemmaOpsMirrorPanel({ onOpen }: GemmaOpsMirrorPanelProps) {
  const [lanes, setLanes] = useState<SourceDetail<GemmaLanesPayload> | null>(null);
  const [hardware, setHardware] = useState<SourceDetail<HardwarePayload> | null>(null);
  const [models, setModels] = useState<SourceDetail<ModelsPayload> | null>(null);
  const [activity, setActivity] = useState<SourceDetail<ActivityPayload> | null>(null);
  const [opsState, setOpsState] = useState<SourceDetail<OpsStatePayload> | null>(null);
  const [usage, setUsage] = useState<SourceDetail<VeliaiUsagePayload> | null>(null);
  const [cloudHealth, setCloudHealth] = useState<SourceDetail<Record<string, unknown>> | null>(null);
  const [cloudCost, setCloudCost] = useState<SourceDetail<Record<string, unknown>> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [nextLanes, nextHardware, nextModels, nextActivity, nextOpsState, nextUsage, nextCloudHealth, nextCloudCost] =
        await Promise.allSettled([
          fetchSource<GemmaLanesPayload>('gemma_lanes', { loggerEvidence: false }),
          fetchSource<HardwarePayload>('gemma_hardware', { loggerEvidence: false }),
          fetchSource<ModelsPayload>('gemma_models', { loggerEvidence: false }),
          fetchSource<ActivityPayload>('gemma_activity', { loggerEvidence: false }),
          fetchSource<OpsStatePayload>('gemma_ops_state', { loggerEvidence: false }),
          fetchSource<VeliaiUsagePayload>('veliai_usage', { loggerEvidence: false }),
          fetchSource<Record<string, unknown>>('gemma_cloud_health', { loggerEvidence: false }),
          fetchSource<Record<string, unknown>>('gemma_cloud_cost', { loggerEvidence: false })
        ]);
      if (cancelled) return;
      if (nextLanes.status === 'fulfilled') setLanes(nextLanes.value);
      if (nextHardware.status === 'fulfilled') setHardware(nextHardware.value);
      if (nextModels.status === 'fulfilled') setModels(nextModels.value);
      if (nextActivity.status === 'fulfilled') setActivity(nextActivity.value);
      if (nextOpsState.status === 'fulfilled') setOpsState(nextOpsState.value);
      if (nextUsage.status === 'fulfilled') setUsage(nextUsage.value);
      if (nextCloudHealth.status === 'fulfilled') setCloudHealth(nextCloudHealth.value);
      if (nextCloudCost.status === 'fulfilled') setCloudCost(nextCloudCost.value);
    }
    load().catch(() => undefined);
    const timer = window.setInterval(() => load().catch(() => undefined), 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const laneRows = lanes?.payload?.lanes || [];
  const workers = (models?.payload?.workers || lanes?.payload?.workers?.workers || []) as Worker[];
  const nvidia = hardware?.payload?.nvidia?.gpus || [];
  const amdPreview = hardware?.payload?.amd_rocm?.raw_preview || '';
  const queue = activity?.payload?.local_llm_queue;
  const topUsage = useMemo(() => {
    return [...(usage?.payload?.usage || [])].sort((a, b) => (b.requests || 0) - (a.requests || 0)).slice(0, 5);
  }, [usage]);
  const degradedLanes = laneRows.filter(lane => lane.circuit_open || lane.circuit !== 'closed').length;
  const state = degradedLanes > 0 ? 'degraded' : lanes?.ok && hardware?.ok ? 'ok' : 'unavailable';

  return (
    <article className="ops-panel gemma-ops-panel">
      <div className="ops-title">
        <div>
          <p className="eyebrow">Gemma Gateway</p>
          <h2>Lane, Queue, Hardware, and Provider Mirror</h2>
        </div>
        <button type="button" onClick={() => onOpen('gemma_ops_state')}>State</button>
      </div>

      <div className="gemma-ops-headline">
        <button type="button" onClick={() => onOpen('gemma_lanes')}>
          <StatusChip state={state} />
          <strong>{short(opsState?.payload?.state, 'waiting')}</strong>
          <span>{short(opsState?.payload?.loaded_backend || opsState?.payload?.backend, 'backend unknown')}</span>
        </button>
        <button type="button" onClick={() => onOpen('gemma_activity')}>
          <strong>{queue?.waiting ?? '--'}</strong>
          <span>waiting</span>
          <small>{queue?.in_flight ?? '--'}/{queue?.max_concurrency ?? '--'} in flight</small>
        </button>
        <button type="button" onClick={() => onOpen('veliai_usage')}>
          <strong>{usage?.payload?.summary?.requests ?? '--'}</strong>
          <span>month requests</span>
          <small>${usage?.payload?.summary?.estimated_cost_usd ?? '--'} estimated</small>
        </button>
        <button type="button" onClick={() => onOpen('gemma_cloud_health')}>
          <strong>{cloudHealth?.payload?.healthy === true ? 'healthy' : cloudHealth?.payload?.healthy === false ? 'degraded' : '--'}</strong>
          <span>cloud route</span>
          <small>${short(cloudCost?.payload?.estimated_hourly_usd, '--')} / hour</small>
        </button>
      </div>

      <LoggerCorrelationProofStrip
        title="Gateway lane proof"
        context="Lane, provider, hardware, and usage cards open the shared Logger correlation query."
        onOpen={onOpen}
      />

      <div className="gemma-lane-grid">
        {laneRows.map(lane => (
          <button type="button" className="gemma-lane-card" key={lane.lane} onClick={() => onOpen('gemma_lanes')}>
            <StatusChip state={stateFor(!lane.circuit_open, lane.circuit)} label={lane.circuit} />
            <h3>{lane.lane}</h3>
            <MetricRow label="in flight" value={`${lane.inflight}/${lane.max_inflight}`} />
            <MetricRow label="queued" value={`${lane.queued}/${lane.max_queued}`} />
            <span className={`router-chip ${lane.circuit_open ? 'hot' : 'ok'}`}>{lane.circuit_open ? 'circuit open' : 'circuit closed'}</span>
          </button>
        ))}
      </div>

      <div className="gemma-ops-split">
        <div className="gemma-worker-list">
          <div className="panel-head compact">
            <div>
              <p className="eyebrow">Lane Workers</p>
              <h2>Loaded models</h2>
            </div>
            <button type="button" onClick={() => onOpen('gemma_models')}>Models</button>
          </div>
          {workers.slice(0, 6).map(worker => (
            <button type="button" key={`${worker.handle}-${worker.port}`} onClick={() => onOpen('gemma_models')}>
              <StatusChip state={stateFor(worker.healthy, worker.state)} label={short(worker.state, 'unknown')} />
              <strong>{short(worker.handle)}</strong>
              <span>{short(worker.device)} - {short(worker.engine)}</span>
              <small>{short(worker.model_path)}</small>
              <small>mmproj {worker.mmproj?.active ? 'active' : short(worker.mmproj?.status, 'n/a')}</small>
            </button>
          ))}
        </div>

        <div className="gemma-hardware-list">
          <div className="panel-head compact">
            <div>
              <p className="eyebrow">Hardware</p>
              <h2>Heat and memory</h2>
            </div>
            <button type="button" onClick={() => onOpen('gemma_hardware')}>Hardware</button>
          </div>
          {nvidia.map(gpu => (
            <button type="button" key={gpu.device} onClick={() => onOpen('gemma_hardware')}>
              <strong>{gpu.name || gpu.device}</strong>
              <MetricRow label="temperature" value={`${gpu.temperature_c}C`} />
              <MetricRow label="utilization" value={`${gpu.utilization_gpu_pct}%`} />
              <MetricRow label="memory" value={`${gpu.memory_used_mib}/${gpu.memory_total_mib} MiB`} />
              <span className={`router-chip ${gpu.temperature_c >= 82 ? 'hot' : 'ok'}`}>{gpu.thermal_state || 'thermal unknown'}</span>
            </button>
          ))}
          <button type="button" onClick={() => onOpen('gemma_hardware')}>
            <strong>AMD / HIP lane</strong>
            <MetricRow label="temperature" value={`${amdMetric(amdPreview, 'Temperature')}C`} />
            <MetricRow label="gpu use" value={`${amdMetric(amdPreview, 'GPU use')}%`} />
            <MetricRow label="raw source" value={hardware?.payload?.amd_rocm?.available ? 'available' : 'unavailable'} />
          </button>
        </div>
      </div>

      <div className="gemma-usage-strip">
        {topUsage.map(row => (
          <button type="button" key={row.endpoint_id} onClick={() => onOpen('veliai_usage')}>
            <strong>{short(row.endpoint_id)}</strong>
            <span>{row.requests} req - {row.input_tokens + row.output_tokens} tok - ${row.estimated_cost_usd}</span>
            <small>{short(row.backpressure_state || row.usage_visibility)}</small>
          </button>
        ))}
        {!topUsage.length && <button type="button" onClick={() => onOpen('veliai_usage')}>Waiting for Veliai usage evidence</button>}
      </div>
    </article>
  );
}
