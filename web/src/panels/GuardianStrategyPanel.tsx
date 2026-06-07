import { useEffect, useMemo, useState } from 'react';
import { fetchSource } from '../api/consoleApi';
import { LoggerCorrelationProofStrip } from '../components/LoggerCorrelationProofStrip';
import { MetricRow } from '../components/MetricRow';
import { StatusChip } from '../components/StatusChip';
import type { SourceDetail } from '../types';

interface GuardianStrategyPanelProps {
  onOpen: (target: string) => void;
}

type AnyRecord = Record<string, unknown>;

type GuardianC2Payload = {
  chain?: {
    state?: string;
    first_fault_node?: string;
    summary?: string;
    hints?: {
      merged_structural_errors?: string[];
      structural_errors?: string[];
    };
  };
  drilldown?: {
    strategy_shadow_compare?: AnyRecord;
    apply_gate?: AnyRecord;
    omega_last_actuation?: AnyRecord;
  };
};

type GuardianTask = {
  task_id?: string;
  job_type?: string;
  status?: string;
  provider?: string;
  model?: string;
  trace_id?: string;
  updated_at_iso?: string;
  output_preview?: string;
  degraded_reasons?: string[];
  error_detail?: string | null;
};

type GemmaActivityPayload = {
  local_llm_queue?: {
    waiting?: number;
    in_flight?: number;
    guardian_tasks_total?: number;
    guardian_tasks_failed?: number;
  };
  guardian_tasks?: GuardianTask[];
};

function record(value: unknown): AnyRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : null;
}

function list<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function text(value: unknown, fallback = '--') {
  if (value === null || value === undefined || value === '') return fallback;
  const next = String(value);
  return next.length > 130 ? `${next.slice(0, 127)}...` : next;
}

function parseJsonRecord(value: unknown): AnyRecord | null {
  if (record(value)) return value as AnyRecord;
  if (typeof value !== 'string') return null;
  try {
    return record(JSON.parse(value));
  } catch {
    return null;
  }
}

function nested(root: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => record(current)?.[key], root);
}

function strategyState(c2?: SourceDetail<GuardianC2Payload> | null, activity?: SourceDetail<GemmaActivityPayload> | null) {
  if (!c2 && !activity) return 'unavailable';
  if (!c2?.ok || !activity?.ok) return 'degraded';
  const quality = record(nested(c2.payload?.drilldown?.strategy_shadow_compare, ['original', 'quality']));
  if (quality && quality.ok === false) return 'degraded';
  if (c2.payload?.chain?.state === 'fault') return 'degraded';
  return 'ok';
}

export function GuardianStrategyPanel({ onOpen }: GuardianStrategyPanelProps) {
  const [c2, setC2] = useState<SourceDetail<GuardianC2Payload> | null>(null);
  const [activity, setActivity] = useState<SourceDetail<GemmaActivityPayload> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [c2Result, activityResult] = await Promise.allSettled([
        fetchSource<GuardianC2Payload>('guardian_c2_snapshot', { loggerEvidence: false }),
        fetchSource<GemmaActivityPayload>('gemma_activity', { loggerEvidence: false })
      ]);
      if (cancelled) return;
      if (c2Result.status === 'fulfilled') setC2(c2Result.value);
      if (activityResult.status === 'fulfilled') setActivity(activityResult.value);
    }
    load().catch(() => undefined);
    const timer = window.setInterval(() => load().catch(() => undefined), 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const model = useMemo(() => {
    const shadowCompare = c2?.payload?.drilldown?.strategy_shadow_compare;
    const original = record(shadowCompare?.original);
    const shadow = record(shadowCompare?.shadow);
    const originalQuality = record(original?.quality);
    const shadowQuality = record(shadow?.quality);
    const originalDoc = record(nested(original, ['response', 'doc']));
    const shadowDoc = record(nested(shadow, ['response', 'doc']));
    const applyGate = c2?.payload?.drilldown?.apply_gate;
    const omega = c2?.payload?.drilldown?.omega_last_actuation;
    const omegaSection = Array.isArray(omega) ? record(record(omega[0])?.section) : record(omega);
    const tasks = list<GuardianTask>(activity?.payload?.guardian_tasks);
    const strategyTasks = tasks.filter(task => String(task.job_type || '').includes('strategy')).slice(0, 8);
    const latestTaskDoc = parseJsonRecord(strategyTasks[0]?.output_preview);
    const failures = [
      ...list<AnyRecord>(originalQuality?.failures),
      ...list<AnyRecord>(shadowQuality?.failures)
    ].slice(0, 6);
    const originalRules = Number(originalQuality?.rule_pass_count || 0);
    const originalTotal = Number(originalQuality?.rule_total || 0);
    const shadowRules = Number(shadowQuality?.rule_pass_count || 0);
    const shadowTotal = Number(shadowQuality?.rule_total || 0);
    const state = strategyState(c2, activity);
    return {
      state,
      shadowCompare,
      originalQuality,
      shadowQuality,
      originalDoc,
      shadowDoc,
      applyGate,
      omegaSection,
      strategyTasks,
      latestTaskDoc,
      failures,
      originalRules,
      originalTotal,
      shadowRules,
      shadowTotal
    };
  }, [c2, activity]);

  const queue = activity?.payload?.local_llm_queue;
  const chain = c2?.payload?.chain;
  const applyGateActive = model.originalQuality?.apply_gate_active === true || model.shadowQuality?.apply_gate_active === true;
  const omegaEvidence = record(model.omegaSection?.bus_logger_evidence);

  return (
    <article className="ops-panel guardian-strategy-panel">
      <div className="ops-title">
        <div>
          <p className="eyebrow">Guardian Strategy</p>
          <h2>Shadow Compare, Quality Gates, and Apply Evidence</h2>
        </div>
        <div className="lawn-source-buttons">
          <button type="button" onClick={() => onOpen('guardian_c2_snapshot')}>C2 Snapshot</button>
          <button type="button" onClick={() => onOpen('gemma_activity')}>Gemma Activity</button>
        </div>
      </div>

      <div className="guardian-strategy-headline">
        <button type="button" onClick={() => onOpen('guardian_c2_snapshot')}>
          <StatusChip state={model.state} />
          <strong>{text(chain?.first_fault_node, 'clear')}</strong>
          <span>{text(chain?.summary, 'waiting for Guardian chain')}</span>
        </button>
        <button type="button" onClick={() => onOpen('guardian_c2_snapshot')}>
          <strong>{model.originalRules}/{model.originalTotal || '--'}</strong>
          <span>primary quality rules</span>
          <small>{text(model.originalQuality?.recommendation, 'quality pending')}</small>
        </button>
        <button type="button" onClick={() => onOpen('guardian_c2_snapshot')}>
          <strong>{model.shadowRules}/{model.shadowTotal || '--'}</strong>
          <span>shadow quality rules</span>
          <small>{model.shadowCompare ? 'shadow compare present' : 'shadow compare waiting'}</small>
        </button>
        <button type="button" onClick={() => onOpen('gemma_activity')}>
          <strong>{model.strategyTasks.length}</strong>
          <span>recent strategy tasks</span>
          <small>{queue?.waiting ?? '--'} waiting / {queue?.in_flight ?? '--'} running</small>
        </button>
      </div>

      <LoggerCorrelationProofStrip
        title="Guardian strategy proof"
        context="Strategy cards open the Bus-backed C2 snapshot and Gemma activity sources; dispatch remains Guardian-owned."
        onOpen={onOpen}
      />

      <div className="guardian-strategy-grid">
        <section>
          <div className="panel-head compact">
            <div>
              <p className="eyebrow">Primary Lane</p>
              <h2>Strategy response</h2>
            </div>
            <StatusChip state={model.originalQuality?.ok === false ? 'degraded' : 'ok'} label={text(model.originalQuality?.status, 'seen')} />
          </div>
          <MetricRow label="route" value={text(model.originalDoc?.route)} />
          <MetricRow label="model" value={text(model.originalDoc?.model)} />
          <MetricRow label="trace" value={text(model.originalDoc?.trace_id)} />
          <p>{text(model.originalDoc?.response || model.originalDoc?.reasoning, 'Waiting for primary strategy response evidence.')}</p>
        </section>

        <section>
          <div className="panel-head compact">
            <div>
              <p className="eyebrow">Shadow Lane</p>
              <h2>Compare and drift</h2>
            </div>
            <StatusChip state={model.shadowQuality?.ok === false ? 'degraded' : model.shadowQuality ? 'ok' : 'unavailable'} label={text(model.shadowQuality?.status, 'pending')} />
          </div>
          <MetricRow label="route" value={text(model.shadowDoc?.route)} />
          <MetricRow label="model" value={text(model.shadowDoc?.model)} />
          <MetricRow label="trace" value={text(model.shadowDoc?.trace_id)} />
          <p>{text(model.shadowDoc?.response || model.shadowDoc?.reasoning, 'Waiting for shadow strategy comparison evidence.')}</p>
        </section>

        <section>
          <div className="panel-head compact">
            <div>
              <p className="eyebrow">Apply Gate</p>
              <h2>Guardian authority</h2>
            </div>
            <StatusChip state={applyGateActive ? 'degraded' : 'ok'} label={applyGateActive ? 'gated' : 'clear'} />
          </div>
          <MetricRow label="omega commands" value={text(model.omegaSection?.commands_total, '0')} />
          <MetricRow label="logger records" value={text(omegaEvidence?.records, '0')} />
          <MetricRow label="bus visible" value={text(omegaEvidence?.bus_visible)} />
          <p>{text(chain?.hints?.merged_structural_errors?.join(' | ') || chain?.hints?.structural_errors?.join(' | '), 'No structural gate text reported by Guardian.')}</p>
        </section>
      </div>

      <div className="guardian-strategy-tasks">
        {model.strategyTasks.map(task => {
          const parsed = parseJsonRecord(task.output_preview);
          const need = parsed?.need_strategy === true;
          return (
            <button type="button" key={task.task_id || task.trace_id} onClick={() => onOpen('gemma_activity')}>
              <span className={`router-chip ${task.status === 'completed' ? 'ok' : 'warn'}`}>{text(task.status)}</span>
              <strong>{text(task.task_id)} - {need ? 'strategy needed' : 'no strategy'}</strong>
              <span>{text(parsed?.reason || task.output_preview, 'no output preview')}</span>
              <small>{text(task.updated_at_iso)} - {text(task.model)} - {text(task.trace_id)}</small>
            </button>
          );
        })}
        {!model.strategyTasks.length && (
          <button type="button" onClick={() => onOpen('gemma_activity')}>Waiting for Guardian strategy task evidence</button>
        )}
      </div>
    </article>
  );
}
