import { useEffect, useMemo, useState } from 'react';
import { fetchSource } from '../api/consoleApi';
import { MetricRow } from '../components/MetricRow';
import { StatusChip } from '../components/StatusChip';
import type { SourceDetail } from '../types';

interface HomeAssistantEvidencePanelProps {
  onOpen: (target: string) => void;
}

type HaProbe = {
  ok?: boolean;
  status?: string;
  error?: string;
};

type HaControlPlane = {
  timestamp_utc?: string;
  mode?: string;
  actuation_mode?: string;
  summary?: string;
  decision_summary?: string;
  ha_probe?: {
    rest?: HaProbe;
    websocket?: HaProbe;
  };
  ha_state_fetch?: {
    ok?: boolean;
    missing?: string[];
    entity_count?: number;
    all_entities?: boolean;
  };
  ha_entity_catalog?: {
    entity_count?: number;
    domain_counts?: Record<string, number>;
    new_entity_ids?: string[];
    removed_entity_ids?: string[];
  };
  actuation_allowlist?: {
    allowed_count?: number;
    blocked_count?: number;
    observe_only_count?: number;
    manual_review_count?: number;
    policy_counts?: Record<string, number>;
    family_counts?: Record<string, number>;
  };
  ha_subscription?: {
    ok?: boolean;
    tracked_entities?: string[];
    events_seen?: number;
    entity_event_counts?: Record<string, number>;
  };
  ha_event_watch?: {
    ok?: boolean;
    tracked_event_types?: string[];
    events_seen?: number;
    event_counts?: Record<string, number>;
  };
  ha_watch_entities?: string[];
  ha_trigger_events?: string[];
  snapshot?: {
    data_json_built_at_utc?: string;
    entity_count?: number;
    missing_entities?: string[];
    pv_w?: number;
    house_load_w?: number;
    grid_w?: number;
    battery_soc?: number;
    energy_price_gbp_per_kwh?: number;
    house_avg_temp_c?: number;
    outdoor_temp_c?: number;
    weather_condition?: string;
    garden_power_live_w?: number;
    spa_is_on?: boolean;
    spa_manual_override?: boolean;
    dehumidifier_is_on?: boolean;
  };
  decision_output?: {
    when_utc?: string;
    decision_source?: string;
    battery_mode?: string;
    spa?: string;
    dishwasher?: string;
    dehumidifier?: string;
    scenario_label?: string;
    guardian_context_summary?: string;
  };
  actuation_attempt?: {
    dry_run?: boolean;
    applied?: unknown[];
    skipped?: unknown[];
  };
};

type GuardianC2Payload = {
  live?: {
    ha_control_plane_status?: HaControlPlane;
  };
};

function payloadObject(payload: unknown): GuardianC2Payload | null {
  return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as GuardianC2Payload : null;
}

function short(value: unknown, fallback = '--') {
  if (value === null || value === undefined || value === '') return fallback;
  const text = String(value);
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

function topEntries(values?: Record<string, number>, limit = 8) {
  return Object.entries(values || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function boolState(value?: boolean) {
  if (value === true) return 'ok';
  if (value === false) return 'degraded';
  return 'unavailable';
}

export function HomeAssistantEvidencePanel({ onOpen }: HomeAssistantEvidencePanelProps) {
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
  const ha = payload?.live?.ha_control_plane_status;
  const snapshot = ha?.snapshot;
  const decision = ha?.decision_output;
  const actuation = ha?.actuation_attempt;
  const domains = useMemo(() => topEntries(ha?.ha_entity_catalog?.domain_counts, 10), [ha]);
  const policyCounts = useMemo(() => topEntries(ha?.actuation_allowlist?.policy_counts, 6), [ha]);
  const watchEntities = ha?.ha_watch_entities || ha?.ha_subscription?.tracked_entities || [];
  const eventTypes = ha?.ha_trigger_events || ha?.ha_event_watch?.tracked_event_types || [];
  const state = detail?.ok && ha ? boolState(ha.ha_state_fetch?.ok !== false && ha.ha_probe?.rest?.ok !== false) : detail ? 'degraded' : 'unavailable';

  return (
    <article className="ops-panel ha-evidence-panel">
      <div className="ops-title">
        <div>
          <p className="eyebrow">Home Assistant Evidence</p>
          <h2>Entity Fabric Consumed by Guardian</h2>
        </div>
        <button type="button" onClick={() => onOpen('guardian_c2_snapshot')}>Guardian Source</button>
      </div>

      <div className="ha-evidence-headline">
        <button type="button" onClick={() => onOpen('guardian_c2_snapshot')}>
          <StatusChip state={state} />
          <strong>{short(ha?.mode, 'waiting')}</strong>
          <span>{short(ha?.actuation_mode, 'actuation unknown')}</span>
          <small>{short(ha?.timestamp_utc || snapshot?.data_json_built_at_utc)}</small>
        </button>
        <button type="button" onClick={() => onOpen('guardian_c2_snapshot')}>
          <strong>{ha?.ha_entity_catalog?.entity_count ?? ha?.ha_state_fetch?.entity_count ?? '--'}</strong>
          <span>HA entities</span>
          <small>{ha?.ha_state_fetch?.all_entities ? 'full state fetch' : 'scoped evidence'}</small>
        </button>
        <button type="button" onClick={() => onOpen('guardian_c2_snapshot')}>
          <strong>{watchEntities.length || '--'}</strong>
          <span>watch entities</span>
          <small>{eventTypes.length || '--'} trigger/event types</small>
        </button>
        <button type="button" onClick={() => onOpen('guardian_c2_snapshot')}>
          <strong>{actuation?.dry_run ? 'dry-run' : 'unknown'}</strong>
          <span>actuation gate</span>
          <small>{(actuation?.applied?.length || 0)} applied / {(actuation?.skipped?.length || 0)} skipped</small>
        </button>
      </div>

      <div className="ha-evidence-grid">
        <section className="ha-energy-card">
          <h3>Energy Snapshot</h3>
          <MetricRow label="PV" value={`${snapshot?.pv_w ?? '--'} W`} />
          <MetricRow label="house load" value={`${snapshot?.house_load_w ?? '--'} W`} />
          <MetricRow label="grid" value={`${snapshot?.grid_w ?? '--'} W`} />
          <MetricRow label="battery" value={`${snapshot?.battery_soc ?? '--'}%`} />
          <MetricRow label="price" value={`£${snapshot?.energy_price_gbp_per_kwh ?? '--'}/kWh`} />
          <MetricRow label="garden" value={`${snapshot?.garden_power_live_w ?? '--'} W`} />
        </section>

        <section className="ha-decision-card">
          <h3>Guardian Decision Context</h3>
          <p>{ha?.summary || 'Waiting for HA summary from Guardian.'}</p>
          <MetricRow label="source" value={short(decision?.decision_source)} />
          <MetricRow label="battery" value={short(decision?.battery_mode)} />
          <MetricRow label="spa" value={short(decision?.spa)} />
          <MetricRow label="dishwasher" value={short(decision?.dishwasher)} />
          <MetricRow label="scenario" value={short(decision?.scenario_label)} />
          <span className="router-chip warn">read-only evidence</span>
        </section>

        <section className="ha-probe-card">
          <h3>Connectivity and Watches</h3>
          <div className="chip-row">
            <span className={`router-chip ${ha?.ha_probe?.rest?.ok === false ? 'hot' : 'ok'}`}>REST {ha?.ha_probe?.rest?.ok === false ? 'degraded' : 'ok'}</span>
            <span className={`router-chip ${ha?.ha_probe?.websocket?.ok === false ? 'hot' : 'ok'}`}>WS {ha?.ha_probe?.websocket?.ok === false ? 'degraded' : 'ok'}</span>
            <span className={`router-chip ${ha?.ha_subscription?.ok === false ? 'hot' : 'ok'}`}>subscription {ha?.ha_subscription?.ok === false ? 'degraded' : 'ok'}</span>
          </div>
          <MetricRow label="state events" value={ha?.ha_subscription?.events_seen ?? '--'} />
          <MetricRow label="bus events" value={ha?.ha_event_watch?.events_seen ?? '--'} />
          <MetricRow label="missing entities" value={ha?.ha_state_fetch?.missing?.length || snapshot?.missing_entities?.length || 0} />
        </section>
      </div>

      <div className="ha-domain-strip">
        {domains.map(([domain, count]) => (
          <button type="button" key={domain} onClick={() => onOpen('guardian_c2_snapshot')}>
            <strong>{count}</strong>
            <span>{domain}</span>
          </button>
        ))}
      </div>

      <div className="ha-policy-strip">
        <div>
          <strong>{ha?.actuation_allowlist?.allowed_count ?? '--'}</strong>
          <span>allowed</span>
        </div>
        <div>
          <strong>{ha?.actuation_allowlist?.blocked_count ?? '--'}</strong>
          <span>blocked</span>
        </div>
        <div>
          <strong>{ha?.actuation_allowlist?.observe_only_count ?? '--'}</strong>
          <span>observe only</span>
        </div>
        <div>
          <strong>{ha?.actuation_allowlist?.manual_review_count ?? '--'}</strong>
          <span>manual review</span>
        </div>
        {policyCounts.map(([name, count]) => (
          <div key={name}>
            <strong>{count}</strong>
            <span>{name}</span>
          </div>
        ))}
      </div>

      <div className="ha-watch-list">
        {watchEntities.slice(0, 10).map(entity => (
          <button type="button" key={entity} onClick={() => onOpen('guardian_c2_snapshot')}>{entity}</button>
        ))}
      </div>
    </article>
  );
}
