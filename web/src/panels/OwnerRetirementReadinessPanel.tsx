import { useEffect, useMemo, useState } from 'react';
import { fetchSource } from '../api/consoleApi';
import { StatusChip } from '../components/StatusChip';
import type { ConsoleOverview, ConsoleSource, SourceDetail } from '../types';

interface OwnerRetirementReadinessPanelProps {
  overview: ConsoleOverview | null;
  onOpen: (target: string) => void;
}

type AnyRecord = Record<string, unknown>;

const detailTargets = [
  'guardian_c2_snapshot',
  'guardian_lawn_outline',
  'gemma_ops_state',
  'gemma_lanes',
  'veliai_providers',
  'logger_ops_dashboard',
  'memorr_archive',
  'memorr_mirror',
  'memorr_source',
  'memorr_email_timeline',
  'actorr_operator_snapshot',
  'actorr_client_bootstrap',
  'owner_action_readiness'
];

function record(value: unknown): AnyRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : null;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function objectCount(value: unknown): number {
  const item = record(value);
  return item ? Object.keys(item).length : 0;
}

function sourceState(source?: ConsoleSource | SourceDetail<unknown> | null) {
  if (!source) return 'unavailable';
  if ('ok' in source) return source.ok ? 'ok' : 'unavailable';
  return source.state;
}

function stateFor(openGates: string[], required: boolean[]) {
  if (openGates.length > 2) return 'unavailable';
  if (openGates.length || !required.every(Boolean)) return 'degraded';
  return 'ok';
}

export function OwnerRetirementReadinessPanel({ overview, onOpen }: OwnerRetirementReadinessPanelProps) {
  const [details, setDetails] = useState<Record<string, SourceDetail<unknown> | null>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const results = await Promise.allSettled(detailTargets.map(target => fetchSource(target, { loggerEvidence: false })));
      if (cancelled) return;
      const next: Record<string, SourceDetail<unknown> | null> = {};
      detailTargets.forEach((target, index) => {
        const result = results[index];
        next[target] = result.status === 'fulfilled' ? result.value : null;
      });
      setDetails(next);
    }
    load().catch(() => undefined);
    const timer = window.setInterval(() => load().catch(() => undefined), 45000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const overviewById = useMemo(() => {
    const rows = new Map<string, ConsoleSource>();
    overview?.sources.forEach(source => rows.set(source.id, source));
    return rows;
  }, [overview]);

  const rows = useMemo(() => {
    const c2 = record(details.guardian_c2_snapshot?.payload);
    const lawn = record(details.guardian_lawn_outline?.payload);
    const gemma = record(details.gemma_ops_state?.payload);
    const lanes = record(details.gemma_lanes?.payload);
    const veliai = record(details.veliai_providers?.payload);
    const logger = record(details.logger_ops_dashboard?.payload);
    const memorrArchive = record(details.memorr_archive?.payload);
    const memorrMirror = record(details.memorr_mirror?.payload);
    const memorrSource = record(details.memorr_source?.payload);
    const memorr = record(details.memorr_email_timeline?.payload);
    const actorr = record(details.actorr_operator_snapshot?.payload);
    const actorrClient = record(details.actorr_client_bootstrap?.payload);
    const actionReadiness = record(details.owner_action_readiness?.payload);
    const actionSummary = record(actionReadiness?.summary);

    const c2Surfaces = objectCount(c2?.surfaces);
    const c2Planes = objectCount(c2?.planes);
    const c2Drilldowns = objectCount(c2?.drilldown);
    const lawnPoints = list(lawn?.saved_boundary).length || list(lawn?.current_boundary).length;
    const workers = list(record(gemma?.inference_engines)?.workers);
    const laneCount = list(lanes?.lanes).length;
    const providers = list(veliai?.endpoints).length;
    const routeNodes = list(record(veliai?.routing_tree)?.nodes).length;
    const timelines = list(record(logger?.command_center)?.incident_timelines).length;
    const correlations = list(logger?.correlations).length;
    const emailCount = Number(record(memorr?.summary)?.email_count || 0);
    const sealedCount = Number(record(memorr?.summary)?.sealed_count || 0);
    const archivedEmails = Number(memorrArchive?.email_count || 0);
    const readyJobs = Number(memorrMirror?.ready_job_count || 0);
    const sleepCandidates = Number(memorrSource?.candidate_count || 0);
    const memorrLifecycleReady = Boolean(details.memorr_archive?.ok && details.memorr_mirror?.ok && details.memorr_source?.ok);
    const actorrSnapshotLive = Boolean(actorr?.ok === true || actorr?.snapshot || actorr?.schema === 'actorr.c2.operator_snapshot.v1');
    const actorrState = actorrSnapshotLive ? 'ok' : sourceState(details.actorr_operator_snapshot || overviewById.get('actorr_operator_snapshot'));
    const actorrClientState = sourceState(details.actorr_client_bootstrap || overviewById.get('actorr_client_bootstrap'));
    const actorrClientVersion = String(actorrClient?.latest_version || 'client version unknown');
    const actorrInstallSuccess = Number(record(actorrClient?.summary)?.install_success || 0);
    const actorrUpdateSuccess = Number(record(actorrClient?.summary)?.update_success || 0);
    const blockedActionOwners = Number(actionSummary?.blocked_action_count || 0);

    return [
      {
        id: 'guardian-c2-retire',
        title: 'Guardian C2 Deck',
        ownerPanel: 'Guardian deck and dashboard stay canonical',
        decision: 'keep owner panel',
        state: stateFor(['apply/rollback proof', 'source-native visual compare', 'Logger action proof'], [c2Surfaces > 0, c2Planes > 0]),
        coverage: [`${c2Surfaces} owner URLs`, `${c2Planes} planes`, `${c2Drilldowns} drilldowns`],
        openGates: ['apply/rollback proof', 'source-native visual compare', 'Logger action proof'],
        sourceIds: ['guardian_c2_snapshot']
      },
      {
        id: 'guardian-lawn-retire',
        title: 'Lawn Boundary Editor',
        ownerPanel: 'Guardian owns persisted boundary and device blocking',
        decision: 'compare before retire',
        state: stateFor(['save contract', 'rollback proof'], [lawnPoints > 0]),
        coverage: [`${lawnPoints} owner boundary points`, 'Console local preview live', 'no persisted writes'],
        openGates: ['save contract', 'rollback proof'],
        sourceIds: ['guardian_lawn_outline', 'guardian_lawn_vision']
      },
      {
        id: 'gemma-ops-retire',
        title: 'Gemma Ops Portal',
        ownerPanel: 'Gateway native ops portal owns runtime truth',
        decision: 'compare before retire',
        state: stateFor(['owner visual compare', 'request Logger proof'], [workers.length > 0, laneCount > 0]),
        coverage: [`${workers.length} workers`, `${laneCount} lanes`, String(record(gemma?.runtime)?.source || 'runtime source unknown')],
        openGates: ['owner visual compare', 'request Logger proof'],
        sourceIds: ['gemma_ops_state', 'gemma_lanes', 'gemma_hardware', 'gemma_activity']
      },
      {
        id: 'veliai-retire',
        title: 'Veliai Router View',
        ownerPanel: 'Veliai owns route selection and rejection policy',
        decision: 'compare before retire',
        state: stateFor(['route drift proof', 'request Logger proof'], [providers > 0, routeNodes > 0]),
        coverage: [`${providers} providers`, `${routeNodes} route nodes`, 'dry-runs visible elsewhere'],
        openGates: ['route drift proof', 'request Logger proof'],
        sourceIds: ['veliai_providers', 'veliai_usage', 'veliai_route_plan_memory']
      },
      {
        id: 'logger-retire',
        title: 'Logger Evidence Console',
        ownerPanel: 'Logger owns proof and incident action authority',
        decision: 'keep owner panel',
        state: stateFor(['correlation invoke stability', 'incident action authority'], [timelines > 0]),
        coverage: [`${timelines} incident timelines`, `${correlations} correlations`, 'snapshot proof visible'],
        openGates: ['correlation invoke stability', 'incident action authority'],
        sourceIds: ['logger_ops_dashboard', 'logger_correlation_query']
      },
      {
        id: 'memorr-retire',
        title: 'Memorr Workbench',
        ownerPanel: 'Memorr owns storage, OCR, mirror, and lifecycle state',
        decision: memorrLifecycleReady ? 'keep owner panel with mirror' : 'blocked',
        state: memorrLifecycleReady ? 'degraded' : 'unavailable',
        coverage: [`${archivedEmails || emailCount} archived emails`, `${sealedCount} sealed`, `${readyJobs} ready jobs`, `${sleepCandidates} sleep candidates`],
        openGates: memorrLifecycleReady
          ? ['OCR action proof missing', 'lifecycle rollback missing', 'Logger proof missing']
          : ['archive/mirror/source state missing', 'OCR action proof missing'],
        sourceIds: ['memorr_email_timeline', 'memorr_archive', 'memorr_mirror', 'memorr_source']
      },
      {
        id: 'actorr-retire',
        title: 'Actorr Operator Surface',
        ownerPanel: 'Actorr remains independent media owner',
        decision: 'blocked',
        state: actorrState === 'ok' && actorrClientState === 'ok' ? 'degraded' : 'unavailable',
        coverage: [
          actorrSnapshotLive ? 'snapshot payload present' : 'snapshot unavailable',
          `snapshot ${actorrState}`,
          `client ${actorrClientState}`,
          `${actorrClientVersion} latest`,
          `${actorrInstallSuccess} installs / ${actorrUpdateSuccess} updates`,
          `${blockedActionOwners} blocked action owners`
        ],
        openGates: actorrState === 'ok' && actorrClientState === 'ok'
          ? ['owner compare proof missing', 'Actorr actions missing', 'mutating media/action soak missing']
          : ['operator or client source unavailable', 'owner compare proof missing'],
        sourceIds: ['actorr_operator_snapshot', 'actorr_client_bootstrap', 'owner_action_readiness']
      }
    ];
  }, [details, overviewById]);

  const compareRollbackLedger = useMemo(() => {
    const actionReadiness = record(details.owner_action_readiness?.payload);
    const summary = record(actionReadiness?.summary);
    const owners = list(actionReadiness?.owners).map(item => record(item)).filter((item): item is AnyRecord => Boolean(item));
    const compareMissing = owners.filter(owner => record(owner.comparison)?.runtime_proof_status !== 'green').length;
    const rollbackMissing = owners.filter(owner => record(owner.rollback)?.execution_proof_status !== 'green').length;
    const fallbackTruth = owners.filter(owner => record(owner.rollback)?.preserves_owner_truth === true).length;
    const actionReady = Number(summary?.action_ready_count || 0);
    const ownerCount = Number(summary?.owner_count || owners.length || 0);
    return [
      {
        label: 'source-native compare',
        value: compareMissing,
        detail: `${ownerCount} owner proofs required`,
        state: compareMissing ? 'blocked' : 'green'
      },
      {
        label: 'rollback execution',
        value: rollbackMissing,
        detail: 'execution proof required',
        state: rollbackMissing ? 'blocked' : 'green'
      },
      {
        label: 'owner truth fallback',
        value: `${fallbackTruth}/${ownerCount}`,
        detail: 'owner truth preserved',
        state: fallbackTruth === ownerCount && ownerCount > 0 ? 'green' : 'blocked'
      },
      {
        label: 'retire actions ready',
        value: actionReady,
        detail: 'no retire controls enabled',
        state: actionReady ? 'green' : 'blocked'
      }
    ];
  }, [details.owner_action_readiness]);

  const blocked = rows.filter(row => row.state === 'unavailable').length;
  const compare = rows.filter(row => row.decision === 'compare before retire').length;

  return (
    <article className="panel wide owner-retirement-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">L3 Retirement Readiness</p>
          <h2>Owner Panel Retirement Board</h2>
        </div>
        <span className="hint">{compare} compare paths · {blocked} blocked · no retire actions</span>
      </div>
      <div className="compare-rollback-ledger">
        {compareRollbackLedger.map(item => (
          <button type="button" key={item.label} onClick={() => onOpen('owner_action_readiness')}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.state} · {item.detail}</small>
          </button>
        ))}
      </div>
      <div className="retirement-grid">
        {rows.map(row => (
          <section className="retirement-card" key={row.id}>
            <div className="parity-card-head">
              <StatusChip state={row.state} label={row.decision} />
              <div>
                <h3>{row.title}</h3>
                <p>{row.ownerPanel}</p>
              </div>
            </div>
            <div className="retirement-coverage">
              {row.coverage.map(item => <span key={item}>{item}</span>)}
            </div>
            <div className="parity-gates">
              {row.openGates.map(gate => <span key={gate}>{gate}</span>)}
            </div>
            <div className="parity-actions">
              {row.sourceIds.map(sourceId => (
                <button type="button" key={sourceId} onClick={() => onOpen(sourceId)}>
                  {sourceId}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
