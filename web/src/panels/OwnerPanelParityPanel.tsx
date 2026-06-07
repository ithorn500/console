import { useEffect, useMemo, useState } from 'react';
import { fetchSource } from '../api/consoleApi';
import { StatusChip } from '../components/StatusChip';
import type { SourceDetail } from '../types';

interface OwnerPanelParityPanelProps {
  onOpen: (target: string) => void;
}

type AnyRecord = Record<string, unknown>;

const targets = [
  'amber_bus_client_health',
  'guardian_c2_snapshot',
  'guardian_lawn_outline',
  'guardian_lawn_vision',
  'gemma_ops_state',
  'gemma_lanes',
  'gemma_hardware',
  'gemma_activity',
  'veliai_providers',
  'veliai_usage',
  'veliai_route_plan_memory',
  'veliai_route_plan_summary',
  'veliai_route_plan_code',
  'veliai_route_plan_long_context',
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
  return record(value) ? Object.keys(value as AnyRecord).length : 0;
}

function sourceState(source?: SourceDetail<unknown> | null) {
  if (!source) return 'unavailable';
  if (!source.ok) return 'degraded';
  return 'ok';
}

function statusFor(required: boolean[], blocked: string[]) {
  if (blocked.length) return 'partial';
  return required.every(Boolean) ? 'ok' : 'degraded';
}

export function OwnerPanelParityPanel({ onOpen }: OwnerPanelParityPanelProps) {
  const [sources, setSources] = useState<Record<string, SourceDetail<unknown> | null>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const results = await Promise.allSettled(targets.map(target => fetchSource(target, { loggerEvidence: false })));
      if (cancelled) return;
      const next: Record<string, SourceDetail<unknown> | null> = {};
      targets.forEach((target, index) => {
        const result = results[index];
        next[target] = result.status === 'fulfilled' ? result.value : null;
      });
      setSources(next);
    }
    load().catch(() => undefined);
    const timer = window.setInterval(() => load().catch(() => undefined), 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const rows = useMemo(() => {
    const c2 = record(sources.guardian_c2_snapshot?.payload);
    const lawn = record(sources.guardian_lawn_outline?.payload);
    const vision = record(sources.guardian_lawn_vision?.payload);
    const gemmaState = record(sources.gemma_ops_state?.payload);
    const lanes = record(sources.gemma_lanes?.payload);
    const activity = record(sources.gemma_activity?.payload);
    const providers = record(sources.veliai_providers?.payload);
    const usage = record(sources.veliai_usage?.payload);
    const routePlanIds = ['veliai_route_plan_memory', 'veliai_route_plan_summary', 'veliai_route_plan_code', 'veliai_route_plan_long_context'];
    const routePlans = routePlanIds.map(id => record(sources[id]?.payload)).filter(Boolean) as AnyRecord[];
    const logger = record(sources.logger_ops_dashboard?.payload);
    const memorrArchive = record(sources.memorr_archive?.payload);
    const memorrMirror = record(sources.memorr_mirror?.payload);
    const memorrSource = record(sources.memorr_source?.payload);
    const memorrTimeline = record(sources.memorr_email_timeline?.payload);
    const actorr = record(sources.actorr_operator_snapshot?.payload);
    const actorrClient = record(sources.actorr_client_bootstrap?.payload);
    const actionReadiness = record(sources.owner_action_readiness?.payload);
    const actionSummary = record(actionReadiness?.summary);

    const c2Planes = objectCount(c2?.planes);
    const c2Drilldowns = objectCount(c2?.drilldown);
    const c2Surfaces = objectCount(c2?.surfaces);
    const strategyCompare = record(record(c2?.drilldown)?.strategy_shadow_compare);
    const originalQuality = record(record(strategyCompare?.original)?.quality);
    const shadowQuality = record(record(strategyCompare?.shadow)?.quality);
    const lawnPoints = list(lawn?.saved_boundary).length || list(lawn?.current_boundary).length;
    const guardPoints = list(lawn?.guard_boundary).length;
    const hazardBoxes = list(record(vision?.attributes)?.hazard_boxes).length;
    const laneCount = list(lanes?.lanes).length;
    const tasks = list(activity?.guardian_tasks).length;
    const strategyTasks = list(activity?.guardian_tasks).filter(task => String(record(task)?.job_type || '').includes('strategy')).length;
    const providerCount = list(providers?.endpoints).length;
    const routeNodes = list(record(providers?.routing_tree)?.nodes).length;
    const requests = Number(record(usage?.summary)?.requests || 0);
    const routeCandidateCount = routePlans.reduce((sum, plan) => sum + list(plan.candidates).length, 0);
    const rejectedRoutes = routePlans.reduce((sum, plan) => sum + list(plan.candidates).filter(candidate => record(candidate)?.eligible === false).length, 0);
    const selectedRoutes = routePlans.map(plan => String(record(plan.selected)?.endpoint_id || 'pending'));
    const timelines = list(record(logger?.command_center)?.incident_timelines).length;
    const correlations = list(logger?.correlations).length;
    const busClientState = sourceState(sources.amber_bus_client_health);
    const memorrArchiveState = sourceState(sources.memorr_archive);
    const memorrMirrorState = sourceState(sources.memorr_mirror);
    const memorrSourceState = sourceState(sources.memorr_source);
    const memorrTimelineCount = Number(record(memorrTimeline?.summary)?.email_count || 0);
    const memorrArchivedEmails = Number(memorrArchive?.email_count || 0);
    const memorrReadyJobs = Number(memorrMirror?.ready_job_count || 0);
    const memorrSleepCandidates = Number(memorrSource?.candidate_count || 0);
    const actorrState = sourceState(sources.actorr_operator_snapshot);
    const actorrClientState = sourceState(sources.actorr_client_bootstrap);
    const actorrVersion = String(actorrClient?.latest_version || 'client unknown');
    const actorrInstallSuccess = Number(record(actorrClient?.summary)?.install_success || 0);
    const actorrUpdateSuccess = Number(record(actorrClient?.summary)?.update_success || 0);
    const blockedActionOwners = Number(actionSummary?.blocked_action_count || 0);

    const parityRows = [
      {
        id: 'guardian-c2',
        title: 'Guardian C2 Deck',
        owner: 'Guardian remains action authority',
        sourceIds: ['guardian_c2_snapshot'],
        mirrored: [`${c2Planes} planes`, `${c2Drilldowns} drilldowns`, `${c2Surfaces} owner surfaces`],
        gates: ['apply execution absent', 'rollback proof absent', 'Logger action proof absent'],
        status: statusFor([c2Planes > 0, c2Drilldowns > 0], ['apply'])
      },
      {
        id: 'guardian-strategy',
        title: 'Guardian Strategy Shadow',
        owner: 'Guardian owns strategy dispatch and apply authority',
        sourceIds: ['guardian_c2_snapshot', 'gemma_activity'],
        mirrored: [
          strategyCompare ? 'shadow compare present' : 'shadow compare missing',
          `primary ${Number(originalQuality?.rule_pass_count || 0)}/${Number(originalQuality?.rule_total || 0)} rules`,
          `shadow ${Number(shadowQuality?.rule_pass_count || 0)}/${Number(shadowQuality?.rule_total || 0)} rules`,
          `${strategyTasks} recent strategy tasks`
        ],
        gates: ['strategy dispatch absent', 'rollback proof absent', 'request-level Logger proof open'],
        status: statusFor([Boolean(strategyCompare), strategyTasks > 0], ['strategy'])
      },
      {
        id: 'guardian-lawn',
        title: 'Lawn Boundary Workflow',
        owner: 'Guardian owns boundary save and blocking policy',
        sourceIds: ['guardian_lawn_outline', 'guardian_lawn_vision'],
        mirrored: [`${lawnPoints} boundary points`, `${guardPoints} guard points`, `${hazardBoxes} hazard boxes now`],
        gates: ['owner save contract absent', 'rollback proof absent'],
        status: statusFor([lawnPoints > 0], ['save'])
      },
      {
        id: 'gemma-ops',
        title: 'Gemma Ops Panel',
        owner: 'Gateway owns lane/model/runtime truth',
        sourceIds: ['gemma_ops_state', 'gemma_lanes', 'gemma_hardware', 'gemma_activity'],
        mirrored: [`${laneCount} lanes`, `${tasks} recent Guardian tasks`, String(gemmaState?.state || 'runtime unknown')],
        gates: ['owner visual compare open', 'Logger correlation per lane open'],
        status: statusFor([laneCount > 0], ['compare'])
      },
      {
        id: 'veliai-router',
        title: 'Veliai Decision Route',
        owner: 'Veliai owns provider selection and rejected alternatives',
        sourceIds: ['veliai_providers', 'veliai_usage', ...routePlanIds],
        mirrored: [`${providerCount} providers`, `${routeNodes} routing nodes`, `${requests} month requests`, `${routePlans.length} dry-runs`, `${rejectedRoutes}/${routeCandidateCount} rejected`, selectedRoutes.join(' / ')],
        gates: ['Logger decision proof open', 'owner-native compare open'],
        status: statusFor([providerCount > 0, routeNodes > 0, routePlans.length === routePlanIds.length, routeCandidateCount > 0], ['decision'])
      },
      {
        id: 'logger-proof',
        title: 'Logger Proof Chain',
        owner: 'Logger owns evidence and correlation proof',
        sourceIds: ['logger_ops_dashboard', 'logger_correlation_query', 'logger_evidence_proof'],
        mirrored: [`${timelines} incident timelines`, `${correlations} correlations in snapshot`, 'Bus query detail attached', 'programme proof route open'],
        gates: ['programme proof route open', 'guarded incident actions absent'],
        status: statusFor([timelines > 0], ['guarded actions'])
      }
    ];

    const actionRows = [
      {
        id: 'service-restart-status',
        title: 'Service Status / Restart',
        authority: 'Owner service decides; Console may only show status.',
        state: statusFor([busClientState === 'ok'], ['restart preview', 'confirmation', 'rollback', 'Logger proof']),
        evidence: [`client health ${busClientState}`, 'overview click-through'],
        gates: ['restart preview absent', 'owner confirmation absent', 'rollback proof absent', 'Logger proof absent'],
        sourceIds: ['amber_bus_client_health', 'amber_bus_overview']
      },
      {
        id: 'guardian-omega-apply',
        title: 'Guardian Omega Apply',
        authority: 'Guardian owns apply execution and house policy.',
        state: statusFor([c2Planes > 0, c2Surfaces > 0], ['apply execution', 'rollback', 'Logger proof']),
        evidence: [`${c2Planes} planes`, `${c2Surfaces} surfaces`, `${c2Drilldowns} drilldowns`],
        gates: ['apply execution absent', 'rollback proof absent', 'Logger proof absent'],
        sourceIds: ['guardian_c2_snapshot']
      },
      {
        id: 'lawn-boundary-save',
        title: 'Lawn Boundary Save',
        authority: 'Guardian owns persisted boundary and blocking policy.',
        state: statusFor([lawnPoints > 0], ['save contract', 'confirmation', 'rollback']),
        evidence: [`${lawnPoints} saved points`, `${guardPoints} guard points`, `${hazardBoxes} hazard boxes`],
        gates: ['owner save contract absent', 'confirmation absent', 'rollback proof absent'],
        sourceIds: ['guardian_lawn_outline', 'guardian_lawn_vision']
      },
      {
        id: 'veliai-route-explain',
        title: 'Veliai Route Explanation',
        authority: 'Veliai owns route selection and rejected alternatives.',
        state: statusFor([routePlans.length === routePlanIds.length, routeCandidateCount > 0], ['Logger decision proof', 'owner-native compare']),
        evidence: [`${routePlans.length} dry-runs`, `${rejectedRoutes}/${routeCandidateCount} rejected`, selectedRoutes.join(' / ')],
        gates: ['Logger decision proof open', 'owner-native compare open'],
        sourceIds: ['veliai_route_plan_memory', 'veliai_route_plan_summary', 'veliai_route_plan_code', 'veliai_route_plan_long_context']
      },
      {
        id: 'queue-retry-dead-letter',
        title: 'Queue Retry / Dead Letter',
        authority: 'Queue owners decide mutation and retry policy.',
        state: 'blocked',
        evidence: [`${timelines} Logger timelines`, 'queue sources click-through only'],
        gates: ['queue retry contract unavailable', 'dead-letter review unavailable', 'mutation proof absent'],
        sourceIds: ['veliai_queue', 'veliai_artifacts', 'logger_ops_dashboard']
      },
      {
        id: 'memorr-ocr-retry',
        title: 'Memorr OCR Retry',
        authority: 'Memorr owns storage and OCR retry execution.',
        state: statusFor([memorrArchiveState === 'ok', memorrMirrorState === 'ok', memorrSourceState === 'ok'], ['OCR retry contract', 'owner rollback']),
        evidence: [
          `archive ${memorrArchiveState}`,
          `mirror ${memorrMirrorState}`,
          `sleep ${memorrSourceState}`,
          `${memorrArchivedEmails || memorrTimelineCount} emails`,
          `${memorrReadyJobs} ready jobs`,
          `${memorrSleepCandidates} sleep candidates`
        ],
        gates: ['OCR retry contract absent', 'owner rollback absent', 'Logger action proof absent'],
        sourceIds: ['memorr_archive', 'memorr_mirror', 'memorr_source', 'memorr_email_timeline']
      },
      {
        id: 'actorr-media-action',
        title: 'Actorr Media Action',
        authority: 'Actorr remains the independent media owner.',
        state: statusFor([actorrState === 'ok', actorrClientState === 'ok'], ['owner compare', 'action contract', 'rollback']),
        evidence: [
          actorr ? 'operator snapshot live' : 'operator snapshot unavailable',
          `client ${actorrClientState}`,
          `${actorrVersion} latest`,
          `${actorrInstallSuccess} installs / ${actorrUpdateSuccess} updates`,
          `${blockedActionOwners} blocked action owners`
        ],
        gates: ['owner compare proof missing', 'Actorr action contract absent', 'mutating rollback proof absent'],
        sourceIds: ['actorr_operator_snapshot', 'actorr_client_bootstrap', 'owner_action_readiness']
      },
      {
        id: 'programme-task-prompt',
        title: 'Programme Task Prompt',
        authority: 'Programme board owns closure evidence.',
        state: 'partial',
        evidence: ['Epic 26 source click-through', 'L9 no-go retained'],
        gates: ['owner closure proof required', 'promotion gate still red'],
        sourceIds: ['epic26_tasks', 'epic26_defogs']
      }
    ];

    return { parityRows, actionRows };
  }, [sources]);

  const okSources = targets.filter(target => sourceState(sources[target]) === 'ok').length;
  const gated = rows.parityRows.reduce((count, row) => count + row.gates.length, 0) + rows.actionRows.reduce((count, row) => count + row.gates.length, 0);

  return (
    <article className="panel wide owner-parity-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">L3 Migration Parity</p>
          <h2>Owner Panels vs Console Mirrors</h2>
        </div>
        <span className="hint">{okSources}/{targets.length} sources live · {gated} gates open</span>
      </div>
      <div className="parity-rail">
        {rows.parityRows.map(row => (
          <section className="parity-card" key={row.id}>
            <div className="parity-card-head">
              <StatusChip state={row.status} label={row.status} />
              <div>
                <h3>{row.title}</h3>
                <p>{row.owner}</p>
              </div>
            </div>
            <div className="parity-strip">
              {row.mirrored.map(item => <span key={item}>{item}</span>)}
            </div>
            <div className="parity-gates">
              {row.gates.map(gate => <span key={gate}>{gate}</span>)}
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
      <div className="action-authority-grid">
        {rows.actionRows.map(row => (
          <section className="action-authority-card" key={row.id}>
            <div className="parity-card-head">
              <StatusChip state={row.state} label={row.state} />
              <div>
                <h3>{row.title}</h3>
                <p>{row.authority}</p>
              </div>
            </div>
            <div className="parity-strip">
              {row.evidence.map(item => <span key={item}>{item}</span>)}
            </div>
            <div className="parity-gates">
              {row.gates.map(gate => <span key={gate}>{gate}</span>)}
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
