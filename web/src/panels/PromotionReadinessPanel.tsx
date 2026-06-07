import { useEffect, useMemo, useState } from 'react';
import { fetchLoggerRequestProofDepth, fetchSource } from '../api/consoleApi';
import { StatusChip } from '../components/StatusChip';
import type { ConsoleOverview, LoggerRequestProofDepth, SourceDetail } from '../types';

interface PromotionReadinessPanelProps {
  overview: ConsoleOverview | null;
  onOpen: (target: string) => void;
}

type AnyRecord = Record<string, unknown>;

const proofTargets = [
  'amber_bus_client_health',
  'guardian_c2_snapshot',
  'guardian_lawn_outline',
  'gemma_ops_state',
  'veliai_route_plan_memory',
  'logger_ops_dashboard',
  'logger_evidence_proof',
  'memorr_archive',
  'memorr_mirror',
  'memorr_source',
  'actorr_operator_snapshot',
  'actorr_client_bootstrap',
  'epic27_windows_runtime_proof',
  'epic27_windows_runtime_readiness',
  'epic27_windows_runtime_handoff',
  'owner_action_readiness',
  'epic26_tasks',
  'epic26_defogs'
];

function record(value: unknown): AnyRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : null;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stateOf(source?: SourceDetail<unknown> | null) {
  if (!source) return 'unavailable';
  return source.ok ? 'ok' : 'unavailable';
}

function countOpen(items: Array<{ state: string }>) {
  return items.filter(item => item.state !== 'ok').length;
}

function text(value: unknown, fallback = '--') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function prettyGate(value: unknown) {
  return text(value).replace(/_/g, ' ');
}

export function PromotionReadinessPanel({ overview, onOpen }: PromotionReadinessPanelProps) {
  const [sources, setSources] = useState<Record<string, SourceDetail<unknown> | null>>({});
  const [loggerRequestProof, setLoggerRequestProof] = useState<LoggerRequestProofDepth | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const sourceRequests = proofTargets.map(target =>
        fetchSource(target, { loggerEvidence: false })
          .then(value => ({ target, value }))
          .catch(() => ({ target, value: null }))
      );
      sourceRequests.forEach(request => {
        request.then(({ target, value }) => {
          if (!cancelled) setSources(previous => ({ ...previous, [target]: value }));
        }).catch(() => undefined);
      });
      const requestProof = fetchLoggerRequestProofDepth()
        .then(value => value)
        .catch(() => null);
      requestProof.then(value => {
        if (!cancelled) setLoggerRequestProof(value);
      }).catch(() => undefined);
      await Promise.allSettled([...sourceRequests, requestProof]);
    }
    load().catch(() => undefined);
    const timer = window.setInterval(() => load().catch(() => undefined), 45000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const model = useMemo(() => {
    const c2 = record(sources.guardian_c2_snapshot?.payload);
    const logger = record(sources.logger_ops_dashboard?.payload);
    const proof = record(sources.logger_evidence_proof?.payload);
    const memorrArchive = record(sources.memorr_archive?.payload);
    const memorrMirror = record(sources.memorr_mirror?.payload);
    const memorrSource = record(sources.memorr_source?.payload);
    const actorr = record(sources.actorr_operator_snapshot?.payload);
    const actorrClient = record(sources.actorr_client_bootstrap?.payload);
    const windowsProof = record(sources.epic27_windows_runtime_proof?.payload);
    const windowsReadiness = record(sources.epic27_windows_runtime_readiness?.payload);
    const windowsHandoff = record(sources.epic27_windows_runtime_handoff?.payload);
    const actionReadiness = record(sources.owner_action_readiness?.payload);
    const actionSummary = record(actionReadiness?.summary);
    const actionOwners = list(actionReadiness?.owners).map(item => record(item)).filter((item): item is AnyRecord => Boolean(item));
    const programme = record(sources.epic26_tasks?.payload);
    const sourceTotal = overview?.summary.total || 0;
    const unavailable = overview?.sources.filter(source => source.state !== 'ok' && source.state !== 'deferred').length || 0;
    const planes = c2 ? Object.keys(record(c2.planes) || {}).length : 0;
    const timelines = list(record(logger?.command_center)?.incident_timelines).length;
    const proofGate = String(proof?.gate_status || proof?.status || (sources.logger_evidence_proof?.ok ? 'reachable' : 'missing'));
    const memorrLive = Boolean(sources.memorr_archive?.ok && sources.memorr_mirror?.ok && sources.memorr_source?.ok);
    const actorrLive = Boolean(sources.actorr_operator_snapshot?.ok && actorr);
    const actorrClientLive = Boolean(sources.actorr_client_bootstrap?.ok && actorrClient?.ok);
    const windowsProofLive = Boolean(sources.epic27_windows_runtime_proof?.ok && sources.epic27_windows_runtime_readiness?.ok && sources.epic27_windows_runtime_handoff?.ok);
    const windowsProofStatus = String(windowsProof?.status || windowsReadiness?.status || windowsHandoff?.status || 'missing');
    const windowsRuntimeObserved = Boolean(windowsProof?.windows_runtime_execution_observed || windowsReadiness?.windows_runtime_execution_observed || windowsHandoff?.windows_runtime_execution_observed);
    const windowsRuntimeGreen = Boolean(windowsProof?.final_l9_windows_runtime_proof_green || windowsReadiness?.final_l9_windows_runtime_proof_green || windowsHandoff?.final_l9_windows_runtime_proof_green);
    const windowsDotnetAvailable = windowsReadiness?.aigateway_dotnet_available === true || windowsHandoff?.aigateway_dotnet_available === true;
    const windowsRequiredSources = Number(windowsHandoff?.required_source_count || 0);
    const windowsOperatorCommands = list(windowsHandoff?.operator_commands).length;
    const windowsCandidateHosts = list(windowsHandoff?.candidate_hosts);
    const windowsNotAuthorized = list(windowsHandoff?.not_authorized);
    const windowsSuccessEvidence = list(windowsHandoff?.required_success_evidence);
    const windowsGuards = record(windowsHandoff?.guards);
    const programmeRows = Number(programme?.row_count || 0);
    const ownerCount = Number(actionSummary?.owner_count || actionOwners.length || 0);
    const actionReadyCount = Number(actionSummary?.action_ready_count || 0);
    const blockedActionCount = Number(actionSummary?.blocked_action_count || 0);
    const compareMissing = ownerCount > 0 ? actionOwners.filter(owner => record(owner.comparison)?.runtime_proof_status !== 'green').length : 0;
    const rollbackMissing = ownerCount > 0 ? actionOwners.filter(owner => record(owner.rollback)?.execution_proof_status !== 'green').length : 0;
    const ownerTruthFallback = actionOwners.filter(owner => record(owner.rollback)?.preserves_owner_truth === true).length;

    const slices = [
      {
        id: 'console-shell',
        title: 'Console Shell',
        state: sourceTotal >= 50 && unavailable <= 8 ? 'degraded' : 'unavailable',
        metric: `${sourceTotal} shared sources`,
        evidence: 'Health, overview, source detail, EventSource reconnect, and no off-host browser proof are live.',
        blocker: 'Action dispatch, rollback, owner compare, and Windows runtime proof still block promotion.',
        source: 'amber_bus_client_health'
      },
      {
        id: 'guardian',
        title: 'Guardian C2 / Lawn',
        state: planes > 0 && stateOf(sources.guardian_lawn_outline) === 'ok' ? 'degraded' : 'unavailable',
        metric: `${planes} C2 planes`,
        evidence: 'C2, strategy, lawn outline, and local boundary preview are visible.',
        blocker: 'Apply/save/rollback/proof workflow remains owner-contract blocked.',
        source: 'guardian_c2_snapshot'
      },
      {
        id: 'gateway-veliai',
        title: 'Gateway / Veliai',
        state: stateOf(sources.gemma_ops_state) === 'ok' && stateOf(sources.veliai_route_plan_memory) === 'ok' ? 'degraded' : 'unavailable',
        metric: stateOf(sources.veliai_route_plan_memory) === 'ok' ? 'dry-run live' : 'dry-run missing',
        evidence: 'Gemma Ops and Veliai route dry-runs are read-only and owner-backed.',
        blocker: 'Owner-native compare, route drift, request-level Logger proof, and Windows runtime are open.',
        source: 'veliai_route_plan_memory'
      },
      {
        id: 'bus-logger-memorr-actorr',
        title: 'Bus / Logger / Memorr / Actorr',
        state: timelines > 0 && memorrLive && actorrLive && actorrClientLive ? 'degraded' : 'unavailable',
        metric: `${timelines} Logger timelines`,
        evidence: 'Bus spine, Logger dashboard/proof, Memorr read-only lifecycle, Actorr snapshot, and Actorr client bootstrap are live.',
        blocker: 'Logger incident action authority, Memorr lifecycle action rollback, Actorr actions, and owner-native compare remain open.',
        source: 'logger_ops_dashboard'
      },
      {
        id: 'perimeter',
        title: 'HA / Perimeter / Media',
        state: overview?.sources.some(source => source.id === 'adguard_status' && source.state === 'ok') ? 'degraded' : 'unavailable',
        metric: 'read-only posture',
        evidence: 'HA evidence and AdGuard read-only posture are visible through Bus contracts.',
        blocker: 'pfSense and MediaDownloader owner contracts are absent; perimeter writes remain out of scope.',
        source: 'adguard_status'
      },
      {
        id: 'retirement',
        title: 'Promote / Retire',
        state: 'unavailable',
        metric: `${programmeRows} programme rows`,
        evidence: 'Readiness and action-authority boards make no-go evidence visible.',
        blocker: 'Promotion checklist cannot go green until owner compare, rollback, and incident rollback proof exist.',
        source: 'epic26_tasks'
      }
    ];

    const rollback = [
      {
        id: 'owner-apply-rollback',
        state: 'blocked',
        title: 'Owner Apply Rollback',
        detail: 'Guardian apply, lawn save, Memorr lifecycle, Logger incident, Actorr media, and perimeter actions have no shared owner rollback contract.'
      },
      {
        id: 'logger-proof',
        state: proofGate === 'evidence_present' || proofGate === 'reachable' ? 'degraded' : 'blocked',
        title: 'Logger Proof Depth',
        detail: `Programme proof route is ${proofGate}; request-specific proof and emitted correlation ids are still open.`
      },
      {
        id: 'windows-runtime',
        state: windowsProofLive && windowsRuntimeObserved && windowsRuntimeGreen ? 'degraded' : 'blocked',
        title: 'Windows Runtime Proof',
        detail: windowsProofLive
          ? `Protected proof sources are live; status ${windowsProofStatus}; dotnet ${windowsDotnetAvailable ? 'available' : 'unavailable'}; ${windowsOperatorCommands} handoff commands cover ${windowsRequiredSources || '--'} sources.`
          : `Protected proof sources are incomplete; status ${windowsProofStatus}.`
      },
      {
        id: 'long-soak',
        state: 'degraded',
        title: 'Long-Duration Soak',
        detail: 'Console, Bus owner-client pressure, and Actorr read-only media/client soaks are proven; mutating owner action soaks remain unavailable pending owner contracts.'
      }
    ];

    const windowsHandoffDetails = {
      status: windowsProofStatus,
      proofMode: text(windowsHandoff?.proof_mode_argument, '--'),
      packageVersion: text(windowsHandoff?.installed_package_version, '--'),
      expectedPath: text(windowsHandoff?.expected_output_path, '--'),
      requiredSourceCount: windowsRequiredSources,
      operatorCommandCount: windowsOperatorCommands,
      candidateHosts: windowsCandidateHosts,
      notAuthorized: windowsNotAuthorized,
      successEvidence: windowsSuccessEvidence,
      remoteExecutionAttempted: windowsGuards?.remote_execution_attempted === true,
      winrmAuthAttempted: windowsGuards?.winrm_auth_attempted === true,
      proofSubmittedByHandoff: windowsGuards?.proof_submission_attempted_by_handoff_source === true,
      credentialMaterialIncluded: windowsGuards?.credential_material_included === true,
      dataPlane: text(windowsGuards?.data_plane, 'amber_bus_only')
    };

    const residual = [
      {
        id: 'owner-action-dispatch',
        label: 'owner action dispatch',
        value: ownerCount > 0 ? actionReadyCount : '--',
        detail: ownerCount > 0 ? `${blockedActionCount} blocked action owners` : 'owner readiness loading',
        source: 'owner_action_readiness',
        blocked: actionReadyCount === 0
      },
      {
        id: 'source-native-compare',
        label: 'source-native compare',
        value: ownerCount > 0 ? compareMissing : '--',
        detail: ownerCount > 0 ? `${ownerTruthFallback}/${ownerCount} owner truth fallbacks` : 'owner compare proof loading',
        source: 'owner_action_readiness',
        blocked: ownerCount === 0 || compareMissing > 0
      },
      {
        id: 'rollback-execution',
        label: 'rollback execution',
        value: ownerCount > 0 ? rollbackMissing : '--',
        detail: ownerCount > 0 ? 'execution proof required' : 'rollback proof loading',
        source: 'owner_action_readiness',
        blocked: ownerCount === 0 || rollbackMissing > 0
      },
      {
        id: 'logger-request-ids',
        label: 'Logger request IDs',
        value: loggerRequestProof?.request_id_count ?? '--',
        detail: `${loggerRequestProof?.correlation_id_count ?? '--'} correlations · ${loggerRequestProof?.state || 'unknown'}`,
        source: 'logger_evidence_proof',
        blocked: loggerRequestProof?.request_specific_ready !== true
      },
      {
        id: 'windows-runtime-proof',
        label: 'Windows runtime',
        value: windowsRuntimeGreen ? 'green' : 'open',
        detail: windowsProofStatus,
        source: 'epic27_windows_runtime_proof',
        blocked: !windowsRuntimeGreen
      },
      {
        id: 'retire-controls',
        label: 'retire controls',
        value: 0,
        detail: 'disabled until contracts green',
        source: 'epic26_tasks',
        blocked: true
      }
    ];

    const contractGateFamilies = [
      'owner_native_compare_proof_missing',
      'owner_preview_contract_missing',
      'operator_confirmation_contract_missing',
      'apply_endpoint_not_proven',
      'action_verification_contract_missing',
      'rollback_execution_proof_missing',
      'logger_action_evidence_missing'
    ];
    const ownerContracts = actionOwners.map(owner => {
      const missing = list(owner.missing_gates).map(item => String(item));
      const familyMissing = contractGateFamilies.filter(gate => missing.includes(gate));
      const ownerId = text(owner.owner_id, 'owner');
      return {
        id: `owner-contract-${ownerId}`,
        title: ownerId,
        source: 'owner_action_readiness',
        state: owner.action_ready === true ? 'ok' : 'blocked',
        metric: `${familyMissing.length}/${contractGateFamilies.length} gates`,
        detail: familyMissing.slice(0, 2).map(prettyGate).join(' · ') || 'contract gates clear',
        footer: `${list(owner.write_capabilities).length} write caps · ${text(owner.stage, 'stage?')}`,
        blocked: owner.action_ready !== true
      };
    });
    const ownerContractMap = [
      ...ownerContracts,
      {
        id: 'contract-logger-request-proof',
        title: 'Logger targeted proof',
        source: 'logger_evidence_proof',
        state: loggerRequestProof?.request_specific_ready === true ? 'ok' : 'blocked',
        metric: `${loggerRequestProof?.request_id_count ?? 0} request ids`,
        detail: `${loggerRequestProof?.correlation_id_count ?? 0} correlations · ${loggerRequestProof?.state || 'blocked'}`,
        footer: loggerRequestProof?.open_gate || 'owner events need request/correlation ids',
        blocked: loggerRequestProof?.request_specific_ready !== true
      },
      {
        id: 'contract-windows-runtime-proof',
        title: 'Windows runtime',
        source: 'epic27_windows_runtime_handoff',
        state: windowsRuntimeGreen ? 'ok' : 'blocked',
        metric: windowsRuntimeGreen ? 'green' : 'open',
        detail: windowsProofStatus,
        footer: `${windowsOperatorCommands} handoff commands · ${windowsRequiredSources || '--'} protected sources`,
        blocked: !windowsRuntimeGreen
      }
    ];
    const actionContractMissing = ownerCount > 0
      ? actionOwners.filter(owner => {
        const missing = list(owner.missing_gates).map(item => String(item));
        return missing.some(gate => [
          'owner_preview_contract_missing',
          'operator_confirmation_contract_missing',
          'apply_endpoint_not_proven',
          'action_verification_contract_missing'
        ].includes(gate));
      }).length
      : 0;
    const proofChain = [
      {
        id: 'chain-source-native-compare',
        label: 'source-native compare',
        value: ownerCount > 0 ? `${compareMissing}/${ownerCount}` : '--',
        detail: `${ownerTruthFallback}/${ownerCount || '--'} owner truth fallback preserved`,
        source: 'owner_action_readiness',
        blocked: ownerCount === 0 || compareMissing > 0
      },
      {
        id: 'chain-action-contract',
        label: 'preview/apply/verify',
        value: ownerCount > 0 ? `${actionContractMissing}/${ownerCount}` : '--',
        detail: 'owner preview, confirmation, apply endpoint, and verify proof required',
        source: 'owner_action_readiness',
        blocked: ownerCount === 0 || actionContractMissing > 0
      },
      {
        id: 'chain-rollback-proof',
        label: 'rollback execution',
        value: ownerCount > 0 ? `${rollbackMissing}/${ownerCount}` : '--',
        detail: 'execution proof required before any retire or dispatch path',
        source: 'owner_action_readiness',
        blocked: ownerCount === 0 || rollbackMissing > 0
      },
      {
        id: 'chain-logger-identifiers',
        label: 'Logger identifiers',
        value: `${loggerRequestProof?.request_id_count ?? 0}/${loggerRequestProof?.correlation_id_count ?? 0}`,
        detail: loggerRequestProof?.open_gate || 'owner events need request/correlation ids',
        source: 'logger_evidence_proof',
        blocked: loggerRequestProof?.request_specific_ready !== true
      },
      {
        id: 'chain-windows-runtime',
        label: 'Windows runtime',
        value: windowsRuntimeGreen ? 'green' : 'open',
        detail: `runtime observed=${windowsRuntimeObserved ? 'yes' : 'no'} · ${windowsRequiredSources || '--'} protected sources`,
        source: 'epic27_windows_runtime_handoff',
        blocked: !windowsRuntimeGreen
      },
      {
        id: 'chain-promotion-controls',
        label: 'promotion controls',
        value: 0,
        detail: 'disabled until proof chain is green',
        source: 'epic26_tasks',
        blocked: true
      }
    ];

    return {
      slices,
      rollback,
      residual,
      ownerContractMap,
      proofChain,
      windowsHandoffDetails,
      openSlices: countOpen(slices),
      openRollback: rollback.filter(item => item.state === 'blocked').length,
      openResidual: residual.filter(item => item.blocked).length,
      openOwnerContracts: ownerContractMap.filter(item => item.blocked).length,
      openProofChain: proofChain.filter(item => item.blocked).length
    };
  }, [overview, sources, loggerRequestProof]);

  return (
    <article className="panel wide promotion-panel" data-promotion-open={model.openSlices + model.openRollback}>
      <div className="panel-head">
        <div>
          <p className="eyebrow">L9 Promotion Gate</p>
          <h2>Go / No-Go and Rollback Proof</h2>
        </div>
        <StatusChip state="unavailable" label="no-go" />
      </div>

      <div className="promotion-summary">
        <section>
          <strong>{model.openSlices}</strong>
          <span>release slices not green</span>
          <small>visible blockers, no hidden promotion</small>
        </section>
        <section>
          <strong>{model.openRollback}</strong>
          <span>rollback gates blocked</span>
          <small>owner contracts required</small>
        </section>
        <section>
          <strong>{overview?.summary.total ?? '--'}</strong>
          <span>shared sources</span>
          <small>Amber Bus-only evidence</small>
        </section>
      </div>

      <div className="residual-blocker-ledger" data-residual-open={model.openResidual}>
        {model.residual.map(item => (
          <button type="button" key={item.id} onClick={() => onOpen(item.source)}>
            <StatusChip state={item.blocked ? 'unavailable' : 'ok'} label={item.blocked ? 'blocked' : 'green'} />
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </button>
        ))}
      </div>

      <div className="owner-contract-map" data-owner-contract-open={model.openOwnerContracts}>
        <div className="panel-head">
          <div>
            <h3>Owner Contract Dependency Map</h3>
            <p className="hint">{model.openOwnerContracts} contract dependencies open</p>
          </div>
          <StatusChip state={model.openOwnerContracts ? 'unavailable' : 'ok'} label={model.openOwnerContracts ? 'owner contracts' : 'clear'} />
        </div>
        <div className="owner-contract-grid">
          {model.ownerContractMap.map(item => (
            <button type="button" key={item.id} onClick={() => onOpen(item.source)}>
              <StatusChip state={item.blocked ? 'unavailable' : 'ok'} label={item.blocked ? 'blocked' : 'green'} />
              <span>{item.title}</span>
              <strong>{item.metric}</strong>
              <small>{item.detail}</small>
              <em>{item.footer}</em>
            </button>
          ))}
        </div>
      </div>

      <div className="promotion-proof-chain" data-proof-chain-open={model.openProofChain} data-proof-chain-controls={0}>
        <div className="panel-head">
          <div>
            <h3>Promotion Proof Chain Gap</h3>
            <p className="hint">{model.openProofChain} prove-before-promote links open</p>
          </div>
          <StatusChip state={model.openProofChain ? 'unavailable' : 'ok'} label={model.openProofChain ? 'proof chain blocked' : 'proof chain green'} />
        </div>
        <div className="promotion-proof-chain-grid">
          {model.proofChain.map(item => (
            <button type="button" key={item.id} onClick={() => onOpen(item.source)}>
              <StatusChip state={item.blocked ? 'unavailable' : 'ok'} label={item.blocked ? 'blocked' : 'green'} />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.detail}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="promotion-grid">
        {model.slices.map(slice => (
          <button type="button" key={slice.id} onClick={() => onOpen(slice.source)}>
            <StatusChip state={slice.state} label={slice.state === 'unavailable' ? 'no-go' : 'partial'} />
            <b>{slice.title}</b>
            <strong>{slice.metric}</strong>
            <span>{slice.evidence}</span>
            <small>{slice.blocker}</small>
          </button>
        ))}
      </div>

      <div className="rollback-grid">
        {model.rollback.map(item => (
          <section key={item.id}>
            <StatusChip state={item.state === 'blocked' ? 'unavailable' : 'degraded'} label={item.state} />
            <b>{item.title}</b>
            <span>{item.detail}</span>
          </section>
        ))}
      </div>

      <div className="windows-handoff-grid">
        <button type="button" onClick={() => onOpen('epic27_windows_runtime_handoff')}>
          <StatusChip state="unavailable" label={model.windowsHandoffDetails.status} />
          <b>Windows Operator Handoff</b>
          <strong>{model.windowsHandoffDetails.requiredSourceCount || '--'} protected sources</strong>
          <span>{model.windowsHandoffDetails.operatorCommandCount} handoff commands · {model.windowsHandoffDetails.proofMode}</span>
          <small>{model.windowsHandoffDetails.expectedPath}</small>
        </button>
        <button type="button" onClick={() => onOpen('epic27_windows_runtime_readiness')}>
          <StatusChip state="degraded" label="candidate hosts" />
          <b>Reachable Windows Hosts</b>
          <strong>{model.windowsHandoffDetails.candidateHosts.length}</strong>
          <span>{model.windowsHandoffDetails.candidateHosts.map(host => text(record(host)?.host, 'host')).join(' · ') || 'no candidate host evidence'}</span>
          <small>TCP reachability only; no WinRM authentication contract.</small>
        </button>
        <button type="button" onClick={() => onOpen('epic27_windows_runtime_handoff')}>
          <StatusChip state={model.windowsHandoffDetails.remoteExecutionAttempted || model.windowsHandoffDetails.winrmAuthAttempted ? 'unavailable' : 'ok'} label="remote guarded" />
          <b>No Remote Execution</b>
          <strong>{model.windowsHandoffDetails.dataPlane}</strong>
          <span>remote={model.windowsHandoffDetails.remoteExecutionAttempted ? 'attempted' : 'not attempted'} · winrm={model.windowsHandoffDetails.winrmAuthAttempted ? 'attempted' : 'not attempted'}</span>
          <small>credentials {model.windowsHandoffDetails.credentialMaterialIncluded ? 'included' : 'not included'} · handoff submission {model.windowsHandoffDetails.proofSubmittedByHandoff ? 'attempted' : 'not attempted'}</small>
        </button>
        <button type="button" onClick={() => onOpen('epic27_windows_runtime_proof')}>
          <StatusChip state="unavailable" label="success required" />
          <b>Green Evidence Required</b>
          <strong>{model.windowsHandoffDetails.successEvidence.length}</strong>
          <span>{model.windowsHandoffDetails.successEvidence.slice(0, 2).map(item => text(item)).join(' ')}</span>
          <small>{model.windowsHandoffDetails.notAuthorized.slice(0, 2).map(item => text(item)).join(' · ')}</small>
        </button>
      </div>
    </article>
  );
}
