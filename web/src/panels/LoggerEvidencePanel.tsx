import { useEffect, useMemo, useState } from 'react';
import { fetchLoggerIncidentStreamProof, fetchLoggerRequestProofDepth, fetchSource } from '../api/consoleApi';
import { MetricRow } from '../components/MetricRow';
import { StatusChip } from '../components/StatusChip';
import type { LoggerIncidentStreamProof, LoggerRequestProofDepth, SourceDetail } from '../types';

interface LoggerEvidencePanelProps {
  onOpen: (target: string) => void;
}

interface LoggerTimelineEvent {
  timestamp?: string;
  kind?: string;
  summary?: string;
  service?: string;
}

interface LoggerIncidentTimeline {
  incident_id?: string;
  title?: string;
  narrative?: string;
  events?: LoggerTimelineEvent[];
}

interface LoggerExplainability {
  incident_id?: string;
  title?: string;
  grouping?: {
    correlation_id?: string | null;
    services?: string[];
    time_span_seconds?: number;
    entry_count?: number;
  };
  decision?: {
    confidence?: {
      score?: number;
      label?: string;
    };
    suspected_root_cause?: string;
    recommended_action?: string;
  };
}

interface LoggerWorkflow {
  incident_id?: string;
  title?: string;
  status?: string;
  owner?: string | null;
  escalation_level?: number;
}

interface LoggerPlaybook {
  incident_id?: string;
  service?: string;
  recommended?: string;
  commands?: Array<{ action?: string }>;
}

interface LoggerDashboard {
  timestamp?: string;
  logs?: unknown[];
  correlations?: unknown[];
  saved_views?: unknown[];
  silent_services?: unknown[];
  analytics?: {
    totals?: Record<string, number>;
    backend?: Record<string, unknown>;
  };
  intelligence?: {
    overview?: Record<string, unknown>;
    anomalies?: unknown[];
    recommendations?: unknown[];
  };
  command_center?: {
    overview?: Record<string, number>;
    adaptive_baselines?: Array<Record<string, unknown>>;
    sequence_chains?: Array<Record<string, unknown>>;
    playbooks?: LoggerPlaybook[];
    owner_workflows?: LoggerWorkflow[];
    incident_timelines?: LoggerIncidentTimeline[];
    federation?: {
      dedupe_candidates?: Array<{ key?: string; incident_ids?: string[]; count?: number }>;
      blast_radius?: {
        nodes?: Array<{ id?: string; weight?: number; critical?: boolean }>;
        edges?: Array<Record<string, unknown>>;
      };
    };
    reliability?: {
      backpressure?: Record<string, unknown>;
      benchmark_gates?: Array<Record<string, unknown>>;
    };
    explainability?: LoggerExplainability[];
    slo?: Record<string, number>;
  };
}

interface LoggerProgrammeEvidenceProof {
  schema?: string;
  generated_at?: string;
  owner?: string;
  domain_truth_policy?: string;
  gate_status?: string;
  event_count?: number;
  owner_apps?: string[];
  route_chain?: string[];
  artifact_refs?: unknown[];
  lifecycle_records?: unknown[];
  queue_artifacts?: unknown[];
  poison_events?: unknown[];
  duplicate_candidates?: Array<{ dedupe_key?: string; key?: string; count?: number }>;
  duplicate_event_count?: number;
  missing_correlation_count?: number;
  incident_ids?: string[];
  incident_timelines?: Array<{
    incident_id?: string;
    title?: string;
    narrative?: string;
    events?: LoggerTimelineEvent[];
  }>;
  retention?: {
    hot_store?: string;
    archive_policy?: string;
    scrub_state?: string;
    raw_domain_truth_policy?: string;
  };
}

function short(value: unknown, fallback = '--') {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function metric(payload: LoggerDashboard | undefined, key: string) {
  return payload?.analytics?.totals?.[key] ?? payload?.command_center?.overview?.[key] ?? 0;
}

export function LoggerEvidencePanel({ onOpen }: LoggerEvidencePanelProps) {
  const [source, setSource] = useState<SourceDetail<LoggerDashboard> | null>(null);
  const [programmeProof, setProgrammeProof] = useState<SourceDetail<LoggerProgrammeEvidenceProof> | null>(null);
  const [streamProof, setStreamProof] = useState<LoggerIncidentStreamProof | null>(null);
  const [requestProof, setRequestProof] = useState<LoggerRequestProofDepth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [programmeProofError, setProgrammeProofError] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [requestProofError, setRequestProofError] = useState<string | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const dashboard = await fetchSource<LoggerDashboard>('logger_ops_dashboard', { loggerEvidence: false });
      if (cancelled) return;
      setSource(dashboard);
      setError(null);
    }
    load().catch(err => setError(err instanceof Error ? err.message : String(err)));
    const timer = window.setInterval(load, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const proof = await fetchSource<LoggerProgrammeEvidenceProof>('logger_evidence_proof', { loggerEvidence: false });
      if (cancelled) return;
      setProgrammeProof(proof);
      setProgrammeProofError(null);
    }
    load().catch(err => setProgrammeProofError(err instanceof Error ? err.message : String(err)));
    const timer = window.setInterval(load, 45000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const proof = await fetchLoggerRequestProofDepth();
      if (cancelled) return;
      setRequestProof(proof);
      setRequestProofError(null);
    }
    load().catch(err => setRequestProofError(err instanceof Error ? err.message : String(err)));
    const timer = window.setInterval(load, 45000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const proof = await fetchLoggerIncidentStreamProof();
      if (cancelled) return;
      setStreamProof(proof);
      setStreamError(null);
    }
    load().catch(err => setStreamError(err instanceof Error ? err.message : String(err)));
    const timer = window.setInterval(load, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const payload = source?.payload;
  const command = payload?.command_center;
  const timelines = command?.incident_timelines || [];
  const selectedIncident = useMemo(() => {
    if (!timelines.length) return undefined;
    return timelines.find(item => item.incident_id === selectedIncidentId) || timelines[0];
  }, [timelines, selectedIncidentId]);
  const explainability = (command?.explainability || []).find(item => item.incident_id === selectedIncident?.incident_id);
  const workflow = (command?.owner_workflows || []).find(item => item.incident_id === selectedIncident?.incident_id);
  const playbook = (command?.playbooks || []).find(item => item.incident_id === selectedIncident?.incident_id);
  const dedupe = (command?.federation?.dedupe_candidates || []).find(item => (item.incident_ids || []).includes(selectedIncident?.incident_id || ''));
  const blastNodes = command?.federation?.blast_radius?.nodes || [];
  const gates = command?.reliability?.benchmark_gates || [];
  const playbooks = command?.playbooks || [];
  const backpressure = command?.reliability?.backpressure || {};
  const proofPayload = programmeProof?.payload;
  const duplicateCandidates = proofPayload?.duplicate_candidates || [];
  const proofIncidentTimelines = proofPayload?.incident_timelines || [];
  const retention = proofPayload?.retention || {};
  const proofRouteChain = proofPayload?.route_chain || [];
  const requestProofHttpStatus = requestProof?.http_status ?? 0;
  const requestProofWindowMode = requestProof?.request_specific_ready
    ? 'ready'
    : requestProof?.event_count
      ? 'identifier_gap'
      : 'no_current_events';
  const requestProofWindowCards = [
    {
      label: 'window mode',
      value: requestProofWindowMode.replace(/_/g, ' '),
      detail: requestProof?.open_gate || 'waiting for owner identifiers',
      tone: requestProof?.request_specific_ready ? 'ok' : 'warn'
    },
    {
      label: 'route status',
      value: requestProofHttpStatus,
      detail: requestProof?.error || requestProof?.state || 'route returned',
      tone: requestProofHttpStatus === 200 ? 'ok' : 'warn'
    },
    {
      label: 'proof events',
      value: requestProof?.event_count || 0,
      detail: requestProof?.ok ? 'events in current window' : 'no current proof events',
      tone: requestProof?.event_count ? 'ok' : 'warn'
    },
    {
      label: 'request/correlation ids',
      value: `${requestProof?.request_id_count || 0}/${requestProof?.correlation_id_count || 0}`,
      detail: requestProof?.request_specific_ready ? 'targeted proof ready' : 'owner identifiers absent',
      tone: requestProof?.request_specific_ready ? 'ok' : 'warn'
    },
    {
      label: 'duration',
      value: `${requestProof?.duration_ms || 0}ms`,
      detail: requestProof?.data_plane || 'data plane pending',
      tone: requestProof?.data_plane === 'amber_bus_only' ? 'ok' : 'warn'
    }
  ];
  const proofCoverage = [
    {
      label: 'events',
      value: requestProof?.event_count || 0,
      detail: requestProof?.ok ? 'current proof window' : 'no current proof events',
      state: requestProof?.ok ? 'ok' : 'unavailable'
    },
    {
      label: 'request ids',
      value: requestProof?.request_id_count || 0,
      detail: requestProof?.sample_request_id || 'owner request id absent',
      state: requestProof?.request_id_count ? 'ok' : 'unavailable'
    },
    {
      label: 'correlation ids',
      value: requestProof?.correlation_id_count || 0,
      detail: requestProof?.sample_correlation_id || 'owner correlation id absent',
      state: requestProof?.correlation_id_count ? 'ok' : 'unavailable'
    },
    {
      label: 'incident ids',
      value: requestProof?.incident_id_count || 0,
      detail: requestProof?.sample_incident_id || 'incident id sample absent',
      state: requestProof?.incident_id_count ? 'degraded' : 'unavailable'
    },
    {
      label: 'migration ids',
      value: requestProof?.migration_id_count || 0,
      detail: 'migration proof identifier',
      state: requestProof?.migration_id_count ? 'ok' : 'unavailable'
    },
    {
      label: 'outcome ids',
      value: requestProof?.outcome_id_count || 0,
      detail: 'action outcome identifier',
      state: requestProof?.outcome_id_count ? 'ok' : 'unavailable'
    },
    {
      label: 'lifecycle stages',
      value: requestProof?.lifecycle_stage_count || 0,
      detail: 'owner lifecycle evidence',
      state: requestProof?.lifecycle_stage_count ? 'ok' : 'unavailable'
    }
  ];

  return (
    <article className="panel wide logger-evidence-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Logger</p>
          <h2>Evidence, Incidents, SLO, and Blast Radius</h2>
        </div>
        <button type="button" onClick={() => onOpen('logger_ops_dashboard')}>Evidence</button>
      </div>

      {error && <div className="router-error">{error}</div>}
      {programmeProofError && <div className="router-error">{programmeProofError}</div>}
      {streamError && <div className="router-error">{streamError}</div>}
      {requestProofError && <div className="router-error">{requestProofError}</div>}

      <div className="logger-metric-grid">
        <button type="button" onClick={() => onOpen('logger_ops_dashboard')}>
          <strong>{metric(payload, 'logs')}</strong>
          <span>logs</span>
        </button>
        <button type="button" onClick={() => onOpen('logger_ops_dashboard')}>
          <strong>{metric(payload, 'incidents')}</strong>
          <span>incidents</span>
        </button>
        <button type="button" onClick={() => onOpen('logger_ops_dashboard')}>
          <strong>{metric(payload, 'open_incidents')}</strong>
          <span>open</span>
        </button>
        <button type="button" onClick={() => onOpen('logger_ops_dashboard')}>
          <strong>{short(command?.overview?.fleet_health_score)}</strong>
          <span>fleet score</span>
        </button>
        <button type="button" onClick={() => onOpen('logger_ops_dashboard')}>
          <strong>{short(command?.slo?.mttd_minutes)}</strong>
          <span>MTTD min</span>
        </button>
        <button type="button" onClick={() => onOpen('logger_ops_dashboard')}>
          <strong>{short(command?.slo?.alert_precision)}</strong>
          <span>alert precision</span>
        </button>
      </div>

      <section
        className="logger-stream-proof"
        data-logger-stream-ok={streamProof?.ok ? 'true' : 'false'}
        data-logger-stream-events={streamProof?.sse_event_count || 0}
      >
        <div className="panel-head">
          <div>
            <p className="eyebrow">Owner SSE</p>
            <h3>Logger-Owned Incident Stream</h3>
          </div>
          <StatusChip state={streamProof?.ok ? 'ok' : 'degraded'} label={streamProof?.ok ? 'stream proven' : 'waiting'} />
        </div>
        <div className="logger-stream-grid">
          <MetricRow label="SSE events" value={short(streamProof?.sse_event_count, '0')} />
          <MetricRow label="logs" value={short(streamProof?.log_count, '0')} />
          <MetricRow label="incidents" value={short(streamProof?.incident_id_count, '0')} />
          <MetricRow label="timelines" value={short(streamProof?.incident_timeline_count, '0')} />
          <MetricRow label="correlations" value={short(streamProof?.correlation_id_count, '0')} />
          <MetricRow label="duration" value={`${short(streamProof?.duration_ms, '0')}ms`} />
        </div>
        <div className="chip-row">
          <span className={`router-chip ${streamProof?.data_plane === 'amber_bus_only' ? 'ok' : 'warn'}`}>Amber Bus contracts only</span>
          <span className={`router-chip ${streamProof?.has_incident_timelines ? 'ok' : 'warn'}`}>incident timeline payload</span>
          <span className={`router-chip ${streamProof?.has_logs ? 'ok' : 'warn'}`}>log payload</span>
          <span className="router-chip ok">bounded reconnect probe</span>
        </div>
      </section>

      <section
        className="logger-programme-proof"
        data-logger-programme-proof-gate={proofPayload?.gate_status || 'loading'}
        data-logger-programme-proof-duplicates={proofPayload?.duplicate_event_count || 0}
        data-logger-programme-proof-timelines={proofIncidentTimelines.length}
      >
        <div className="panel-head">
          <div>
            <p className="eyebrow">Programme Evidence</p>
            <h3>Logger Evidence Proof Ledger</h3>
          </div>
          <StatusChip
            state={programmeProof?.ok ? 'ok' : 'degraded'}
            label={proofPayload?.gate_status || 'waiting'}
          />
        </div>
        <div className="logger-programme-grid">
          <button type="button" onClick={() => onOpen('logger_evidence_proof')}>
            <strong>{short(proofPayload?.event_count, '0')}</strong>
            <span>proof events</span>
            <small>{short(proofPayload?.generated_at, programmeProof?.generated_at)}</small>
          </button>
          <button type="button" onClick={() => onOpen('logger_evidence_proof')}>
            <strong>{short(proofPayload?.duplicate_event_count, '0')}</strong>
            <span>duplicate events</span>
            <small>{duplicateCandidates.length} candidate keys</small>
          </button>
          <button type="button" onClick={() => onOpen('logger_evidence_proof')}>
            <strong>{proofIncidentTimelines.length}</strong>
            <span>incident timelines</span>
            <small>{(proofPayload?.incident_ids || []).slice(0, 2).join(' | ') || 'no incident ids'}</small>
          </button>
          <button type="button" onClick={() => onOpen('logger_evidence_proof')}>
            <strong>{proofRouteChain.length || '--'}</strong>
            <span>route chain</span>
            <small>{proofRouteChain.join(' -> ') || 'no route chain'}</small>
          </button>
          <button type="button" onClick={() => onOpen('logger_evidence_proof')}>
            <strong>{short(proofPayload?.missing_correlation_count, '0')}</strong>
            <span>missing correlations</span>
            <small>{short(proofPayload?.owner_apps?.join(', '), 'no owner apps')}</small>
          </button>
        </div>
        <div className="logger-programme-detail">
          <section>
            <h4>Duplicate Candidates</h4>
            {duplicateCandidates.slice(0, 4).map((candidate, index) => (
              <button type="button" key={`${candidate.dedupe_key || candidate.key}-${index}`} onClick={() => onOpen('logger_evidence_proof')}>
                <strong>{short(candidate.count, '0')}</strong>
                <span>{short(candidate.dedupe_key || candidate.key, 'dedupe key missing')}</span>
              </button>
            ))}
            {!duplicateCandidates.length && <p>No duplicate candidates in the current proof window.</p>}
          </section>
          <section>
            <h4>Retention Boundary</h4>
            <button type="button" onClick={() => onOpen('logger_evidence_proof')}>
              <strong>{short(retention.scrub_state, 'unknown')}</strong>
              <span>{short(retention.hot_store, 'hot store unavailable')}</span>
              <small>{short(retention.raw_domain_truth_policy || retention.archive_policy, 'retention policy unavailable')}</small>
            </button>
          </section>
        </div>
        <div className="chip-row">
          <span className={`router-chip ${programmeProof?.data_plane === 'amber_bus_only' ? 'ok' : 'warn'}`}>Amber Bus contracts only</span>
          <span className={`router-chip ${proofPayload?.gate_status === 'evidence_present' ? 'ok' : 'warn'}`}>{proofPayload?.gate_status || 'proof pending'}</span>
          <span className="router-chip ok">Logger owns retention and proof query</span>
          <span className={`router-chip ${requestProof?.request_specific_ready ? 'ok' : 'warn'}`}>{requestProof?.request_specific_ready ? 'targeted ids emitted' : 'targeted ids still missing'}</span>
        </div>
      </section>

      <section
        className="logger-stream-proof logger-request-proof"
        data-logger-request-proof-state={requestProof?.state || 'loading'}
        data-logger-request-proof-ready={requestProof?.request_specific_ready ? 'true' : 'false'}
        data-logger-request-proof-events={requestProof?.event_count || 0}
      >
        <div className="panel-head">
          <div>
            <p className="eyebrow">Request Proof</p>
            <h3>Logger Request-Specific Proof Depth</h3>
          </div>
          <StatusChip
            state={requestProof?.request_specific_ready ? 'ok' : requestProof?.ok ? 'degraded' : 'unavailable'}
            label={requestProof?.request_specific_ready ? 'ids emitted' : requestProof?.ok ? 'owner gap visible' : 'waiting'}
          />
        </div>
        <div className="logger-stream-grid">
          <MetricRow label="events" value={short(requestProof?.event_count, '0')} />
          <MetricRow label="request ids" value={short(requestProof?.request_id_count, '0')} />
          <MetricRow label="correlation ids" value={short(requestProof?.correlation_id_count, '0')} />
          <MetricRow label="incident ids" value={short(requestProof?.incident_id_count, '0')} />
          <MetricRow label="missing corr" value={short(requestProof?.missing_correlation_count, '0')} />
          <MetricRow label="duration" value={`${short(requestProof?.duration_ms, '0')}ms`} />
        </div>
        <div className="chip-row">
          <span className={`router-chip ${requestProof?.data_plane === 'amber_bus_only' ? 'ok' : 'warn'}`}>Amber Bus contracts only</span>
          <span className={`router-chip ${requestProof?.ok ? 'ok' : 'warn'}`}>logger.evidence.proof</span>
          <span className="router-chip ok">{requestProof?.proof_scope || 'proof scope pending'}</span>
          <span className={`router-chip ${requestProof?.request_specific_ready ? 'ok' : 'warn'}`}>{requestProof?.open_gate || 'waiting for owner identifiers'}</span>
          {requestProof?.sample_incident_id && <span className="router-chip ok">sample incident {requestProof.sample_incident_id}</span>}
        </div>
        <div className="logger-emission-ledger">
          <button type="button" onClick={() => onOpen('logger_evidence_proof')}>
            <span>proof state</span>
            <strong>{requestProof?.state || 'loading'}</strong>
            <small>{requestProof?.request_specific_ready ? 'request proof ready' : 'request-specific proof blocked'}</small>
          </button>
          <button type="button" onClick={() => onOpen('logger_evidence_proof')}>
            <span>request identifiers</span>
            <strong>{short(requestProof?.request_id_count, '0')}</strong>
            <small>{short(requestProof?.sample_request_id, 'no request id emitted')}</small>
          </button>
          <button type="button" onClick={() => onOpen('logger_evidence_proof')}>
            <span>correlation identifiers</span>
            <strong>{short(requestProof?.correlation_id_count, '0')}</strong>
            <small>{short(requestProof?.sample_correlation_id, 'no correlation id emitted')}</small>
          </button>
          <button type="button" onClick={() => onOpen('logger_evidence_proof')}>
            <span>incident identifiers</span>
            <strong>{short(requestProof?.incident_id_count, '0')}</strong>
            <small>{short(requestProof?.sample_incident_id, 'no incident sample')}</small>
          </button>
          <button type="button" onClick={() => onOpen('logger_evidence_proof')}>
            <span>owner emission gate</span>
            <strong>{requestProof?.request_specific_ready ? 'clear' : 'blocked'}</strong>
            <small>{short(requestProof?.open_gate, 'waiting for owner identifiers')}</small>
          </button>
        </div>
        <div
          className="logger-proof-window"
          data-logger-proof-window-mode={requestProofWindowMode}
          data-logger-proof-window-http={requestProofHttpStatus}
          data-logger-proof-window-events={requestProof?.event_count || 0}
          data-logger-proof-window-ready={requestProof?.request_specific_ready ? 'true' : 'false'}
        >
          <div className="panel-head">
            <div>
              <p className="eyebrow">Proof Window State</p>
              <h3>Current Logger Proof Window</h3>
            </div>
            <StatusChip
              state={requestProof?.request_specific_ready ? 'ok' : requestProof?.ok ? 'degraded' : 'unavailable'}
              label={requestProofWindowMode.replace(/_/g, ' ')}
            />
          </div>
          <div className="logger-proof-window-grid">
            {requestProofWindowCards.map(item => (
              <button type="button" key={item.label} onClick={() => onOpen('logger_evidence_proof')}>
                <StatusChip state={item.tone === 'ok' ? 'ok' : 'unavailable'} label={item.tone === 'ok' ? 'present' : 'open'} />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="logger-proof-coverage" data-logger-proof-open={requestProof?.request_specific_ready ? '0' : '1'}>
          <div className="panel-head">
            <div>
              <p className="eyebrow">Targeted Proof Coverage</p>
              <h3>Identifier Coverage Matrix</h3>
            </div>
            <StatusChip state={requestProof?.request_specific_ready ? 'ok' : 'unavailable'} label={requestProof?.request_specific_ready ? 'request proof ready' : 'owner ids missing'} />
          </div>
          <div className="logger-coverage-grid">
            {proofCoverage.map(item => (
              <button type="button" key={item.label} onClick={() => onOpen('logger_evidence_proof')}>
                <StatusChip state={item.state} label={item.state === 'ok' ? 'present' : item.state === 'degraded' ? 'partial' : 'missing'} />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </button>
            ))}
          </div>
          <p className="logger-proof-open-gate">{short(requestProof?.open_gate, 'waiting for owner identifiers')}</p>
        </div>
      </section>

      <div className="logger-evidence-stage">
        <section className="logger-timeline">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Incident Timeline</p>
              <h3>{selectedIncident?.title || 'No active incident selected'}</h3>
            </div>
            <StatusChip state={source?.ok ? 'ok' : 'degraded'} label={source?.ok ? 'live' : 'waiting'} />
          </div>
          <div className="logger-incident-tabs">
            {timelines.slice(0, 6).map(item => (
              <button
                className={item.incident_id === selectedIncident?.incident_id ? 'active' : ''}
                type="button"
                key={item.incident_id || item.title}
                onClick={() => setSelectedIncidentId(item.incident_id || null)}
              >
                <b>{item.title || 'incident'}</b>
                <span>{item.incident_id || 'no id'}</span>
              </button>
            ))}
          </div>
          <div className="logger-timeline-track">
            {(selectedIncident?.events || []).slice(0, 10).map((event, index) => (
              <button type="button" className="logger-timeline-event" key={`${event.timestamp || 'event'}-${index}`} onClick={() => onOpen('logger_ops_dashboard')}>
                <i />
                <b>{event.kind || 'event'}</b>
                <span>{event.summary || '--'}</span>
                <small>{event.service || event.timestamp || '--'}</small>
              </button>
            ))}
            {!selectedIncident?.events?.length && <div className="logger-empty">No incident events in the current Logger snapshot.</div>}
          </div>
        </section>

        <section className="logger-side">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Command Center</p>
              <h3>Root-cause and reliability proof</h3>
            </div>
          </div>
          <MetricRow label="backend" value={short(payload?.analytics?.backend?.name)} />
          <MetricRow label="backpressure" value={short(backpressure.status)} />
          <MetricRow label="throughput/min" value={short(backpressure.current_throughput_per_minute)} />
          <div className="chip-row">
            {gates.map(gate => <span className={`router-chip ${gate.status === 'pass' ? 'ok' : 'warn'}`} key={short(gate.name)}>{short(gate.name)} {short(gate.status)}</span>)}
          </div>
          <div className="logger-mini-list">
            {playbooks.slice(0, 5).map(item => (
              <button type="button" key={short(item.incident_id)} onClick={() => onOpen('logger_ops_dashboard')}>
                <b>{short(item.recommended)}</b>
                <span>{short(item.incident_id)} · {short(item.service)}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="logger-proof-grid">
        <section className="logger-proof-card">
          <div>
            <p className="eyebrow">Correlation Proof</p>
            <h3>{selectedIncident?.incident_id || 'no incident'}</h3>
          </div>
          <MetricRow label="correlation id" value={short(explainability?.grouping?.correlation_id, 'not emitted')} />
          <MetricRow label="service span" value={(explainability?.grouping?.services || []).join(', ') || '--'} />
          <MetricRow label="entries" value={short(explainability?.grouping?.entry_count)} />
          <MetricRow label="time span" value={`${short(explainability?.grouping?.time_span_seconds, '0')}s`} />
          <div className="chip-row">
            <span className={`router-chip ${explainability?.grouping?.correlation_id ? 'ok' : 'warn'}`}>
              {explainability?.grouping?.correlation_id ? 'correlation emitted' : 'correlation id absent'}
            </span>
            <span className="router-chip ok">owner snapshot proof</span>
            <span className="router-chip ok">Bus query attached</span>
          </div>
        </section>

        <section className="logger-proof-card">
          <div>
            <p className="eyebrow">Explainability</p>
            <h3>{short(explainability?.decision?.confidence?.label, 'no confidence')}</h3>
          </div>
          <MetricRow label="confidence" value={short(explainability?.decision?.confidence?.score)} />
          <p>{short(explainability?.decision?.suspected_root_cause, 'No suspected root cause in current snapshot.')}</p>
          <p>{short(explainability?.decision?.recommended_action, 'No recommendation in current snapshot.')}</p>
        </section>

        <section className="logger-proof-card">
          <div>
            <p className="eyebrow">Owner Workflow</p>
            <h3>{short(workflow?.status, 'unknown')}</h3>
          </div>
          <MetricRow label="owner" value={short(workflow?.owner, 'unassigned')} />
          <MetricRow label="escalation" value={short(workflow?.escalation_level, '0')} />
          <MetricRow label="dedupe key" value={short(dedupe?.key)} />
          <MetricRow label="dedupe count" value={short(dedupe?.count)} />
        </section>

        <section className="logger-proof-card">
          <div>
            <p className="eyebrow">Guarded Playbook</p>
            <h3>{short(playbook?.recommended, 'none')}</h3>
          </div>
          <MetricRow label="service" value={short(playbook?.service)} />
          <div className="chip-row">
            {(playbook?.commands || []).map(command => <span className="router-chip warn" key={command.action}>{short(command.action)} preview only</span>)}
            {!playbook?.commands?.length && <span className="router-chip warn">no commands</span>}
          </div>
          <button type="button" onClick={() => onOpen('logger_ops_dashboard')}>Open Logger Snapshot</button>
        </section>

        <section className="logger-proof-card">
          <div>
            <p className="eyebrow">Bus Correlation Query</p>
            <h3>logger.correlation.query</h3>
          </div>
          <MetricRow label="interface" value="logger.api.correlation.query.v1" />
          <MetricRow label="data plane" value="Amber Bus" />
          <MetricRow label="load mode" value="click-through" />
          <MetricRow label="programme proof" value="logger.evidence.proof open" />
          <div className="chip-row">
            <span className="router-chip ok">source detail attached</span>
            <span className="router-chip ok">proof route evidence_present</span>
          </div>
          <button type="button" onClick={() => onOpen('logger_correlation_query')}>Open Correlation Query</button>
          <button type="button" onClick={() => onOpen('logger_evidence_proof')}>Open Evidence Proof</button>
        </section>
      </div>

      <div className="logger-blast-grid">
        {blastNodes.slice(0, 8).map(node => (
          <button type="button" className={node.critical ? 'critical' : ''} key={`${node.id}-${node.weight}`} onClick={() => onOpen('logger_ops_dashboard')}>
            <strong>{short(node.weight, '0')}</strong>
            <span>{node.id || 'unknown service'}</span>
          </button>
        ))}
      </div>
    </article>
  );
}
