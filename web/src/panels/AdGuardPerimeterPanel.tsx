import { useEffect, useMemo, useState } from 'react';
import { fetchLoggerIncidentStreamProof, fetchLoggerRequestProofDepth, fetchSource } from '../api/consoleApi';
import { MetricRow } from '../components/MetricRow';
import { StatusChip } from '../components/StatusChip';
import type { LoggerIncidentStreamProof, LoggerRequestProofDepth, SourceDetail } from '../types';

interface AdGuardPerimeterPanelProps {
  onOpen: (target: string) => void;
}

type InvokePayload<T> = {
  ok?: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
};

type StatusData = {
  running?: boolean;
  version?: string;
  dns_addresses?: string[];
  dns_port?: number;
  http_port?: number;
  protection_enabled?: boolean;
  dhcp_available?: boolean;
  start_time?: string;
};

type FilteringData = {
  protection_enabled?: boolean;
  filtering_enabled?: boolean;
  safe_browsing_enabled?: boolean;
  safe_search_enabled?: boolean;
  parental_enabled?: boolean;
  rewrites_enabled?: boolean;
  filters_update_interval_hours?: number;
  filter_count?: number;
  whitelist_filter_count?: number;
  user_rule_count?: number;
};

type SecurityData = {
  generated_at?: string;
  risk_level?: string;
  signals?: string[];
  stats_error?: string;
};

type ClientData = {
  clients?: Array<{
    name?: string;
    ids?: string[];
    filtering_enabled?: boolean;
    safe_browsing_enabled?: boolean;
    parental_enabled?: boolean;
  }>;
};

type QueryData = {
  result?: {
    data?: unknown[];
    oldest?: string;
    old_time?: string;
  };
};

const liveSourceIds = [
  'adguard_status',
  'adguard_stats',
  'adguard_querylog',
  'adguard_clients',
  'adguard_filtering',
  'adguard_security'
] as const;

type SourceId = typeof liveSourceIds[number];

const blockedContracts = [
  {
    title: 'pfSense',
    state: 'contract blocked',
    owner: 'pfsense.amber.com',
    evidence: 'No approved Amber Bus read-only owner feed.',
    gate: 'Firewall/router controls require operator approval.'
  },
  {
    title: 'MediaDownloader',
    state: 'contract blocked',
    owner: 'mediadownloader.amber.com',
    evidence: 'Sonarr, Radarr, and SABnzbd source forks are mounted only.',
    gate: 'Queue, history, and health panels wait for owner contracts.'
  }
] as const;

const perimeterHandoffPhases = [
  {
    label: 'owner Bus feed',
    detail: 'approved read-only posture route required',
    pfsense: 'missing',
    media: 'missing'
  },
  {
    label: 'operator approval',
    detail: 'maintenance plan before firewall/media operations',
    pfsense: 'required',
    media: 'required'
  },
  {
    label: 'Console control posture',
    detail: 'DNS, DHCP, firewall, queue, and downloader writes absent',
    pfsense: 'locked',
    media: 'locked'
  },
  {
    label: 'Logger linkage',
    detail: 'security/acquisition event IDs must be owner-emitted',
    pfsense: 'pending',
    media: 'pending'
  }
] as const;

function unwrap<T>(detail?: SourceDetail<unknown>): T | undefined {
  if (!detail?.payload || typeof detail.payload !== 'object') return undefined;
  const payload = detail.payload as InvokePayload<T>;
  return (payload.data || detail.payload) as T;
}

function invokeOk(detail?: SourceDetail<unknown>) {
  if (!detail?.ok) return false;
  const payload = detail.payload as InvokePayload<unknown> | undefined;
  return payload?.ok !== false;
}

function boolText(value?: boolean) {
  if (value === true) return 'on';
  if (value === false) return 'off';
  return '--';
}

function short(value: unknown, fallback = '--') {
  if (value === null || value === undefined || value === '') return fallback;
  const text = String(value);
  return text.length > 72 ? `${text.slice(0, 69)}...` : text;
}

function countArray(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

export function AdGuardPerimeterPanel({ onOpen }: AdGuardPerimeterPanelProps) {
  const [details, setDetails] = useState<Partial<Record<SourceId, SourceDetail<unknown>>>>({});
  const [incidentProof, setIncidentProof] = useState<LoggerIncidentStreamProof | null>(null);
  const [requestProof, setRequestProof] = useState<LoggerRequestProofDepth | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const settled = await Promise.allSettled(liveSourceIds.map(id => fetchSource(id, { loggerEvidence: false })));
      if (cancelled) return;
      const next: Partial<Record<SourceId, SourceDetail<unknown>>> = {};
      settled.forEach((item, index) => {
        if (item.status === 'fulfilled') next[liveSourceIds[index]] = item.value;
      });
      setDetails(next);
    }
    load().catch(() => undefined);
    const timer = window.setInterval(() => load().catch(() => undefined), 90000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadLoggerProof() {
      const [incident, request] = await Promise.allSettled([
        fetchLoggerIncidentStreamProof(),
        fetchLoggerRequestProofDepth()
      ]);
      if (cancelled) return;
      setIncidentProof(incident.status === 'fulfilled' ? incident.value : null);
      setRequestProof(request.status === 'fulfilled' ? request.value : null);
    }
    loadLoggerProof().catch(() => undefined);
    const timer = window.setInterval(() => loadLoggerProof().catch(() => undefined), 120000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const status = unwrap<StatusData>(details.adguard_status);
  const filtering = unwrap<FilteringData>(details.adguard_filtering);
  const security = unwrap<SecurityData>(details.adguard_security);
  const clients = unwrap<ClientData>(details.adguard_clients);
  const query = unwrap<QueryData>(details.adguard_querylog);
  const stats = unwrap<Record<string, unknown>>(details.adguard_stats);
  const liveCount = liveSourceIds.filter(id => invokeOk(details[id])).length;
  const risk = security?.risk_level || (status?.running && filtering?.protection_enabled ? 'info' : 'warning');
  const loggerRouteLive = incidentProof?.ok === true || requestProof?.ok === true;
  const requestLinkReady = requestProof?.request_specific_ready === true && (requestProof?.request_id_count || 0) > 0 && (requestProof?.correlation_id_count || 0) > 0;
  const securitySignals = security?.signals?.length || 0;
  const loggerLinkState = requestLinkReady && securitySignals > 0 ? 'linked' : 'pending';
  const clientRows = useMemo(() => (clients?.clients || []).slice(0, 6), [clients]);
  const queryRows = Array.isArray(query?.result?.data) ? query.result.data.slice(0, 5) : [];
  const policySignals = useMemo(() => [
    filtering?.protection_enabled ? 'protection.enabled' : 'protection.off',
    filtering?.filtering_enabled ? 'filtering.enabled' : 'filtering.off',
    filtering?.safe_browsing_enabled ? 'safe_browsing.enabled' : 'safe_browsing.off'
  ], [filtering]);

  return (
    <article className="ops-panel adguard-panel">
      <div className="ops-title">
        <div>
          <p className="eyebrow">Perimeter</p>
          <h2>AdGuard Read-Only Posture</h2>
        </div>
        <button type="button" onClick={() => onOpen('adguard_security')}>Security Source</button>
      </div>

      <div className="adguard-headline">
        <button type="button" onClick={() => onOpen('adguard_status')}>
          <StatusChip state={status?.running ? 'ok' : 'degraded'} />
          <strong>{status?.running ? 'running' : 'waiting'}</strong>
          <span>{short(status?.version)}</span>
          <small>{liveCount}/{liveSourceIds.length} Bus sources live</small>
        </button>
        <button type="button" onClick={() => onOpen('adguard_filtering')}>
          <strong>{boolText(filtering?.protection_enabled)}</strong>
          <span>protection</span>
          <small>filtering {boolText(filtering?.filtering_enabled)}</small>
        </button>
        <button type="button" onClick={() => onOpen('adguard_security')}>
          <strong>{short(risk)}</strong>
          <span>risk level</span>
          <small>{security?.signals?.length || 0} signals</small>
        </button>
        <button type="button" onClick={() => onOpen('adguard_clients')}>
          <strong>{clients?.clients?.length ?? '--'}</strong>
          <span>known clients</span>
          <small>policy metadata only</small>
        </button>
      </div>

      <div className="adguard-grid">
        <section>
          <h3>Runtime</h3>
          <MetricRow label="DNS port" value={status?.dns_port ?? '--'} />
          <MetricRow label="HTTP port" value={status?.http_port ?? '--'} />
          <MetricRow label="DHCP available" value={boolText(status?.dhcp_available)} />
          <MetricRow label="started" value={short(status?.start_time)} />
          <div className="chip-row">
            {(status?.dns_addresses || []).slice(0, 4).map(address => (
              <span className="router-chip ok" key={address}>{address}</span>
            ))}
          </div>
        </section>

        <section>
          <h3>Filtering</h3>
          <MetricRow label="filters" value={filtering?.filter_count ?? '--'} />
          <MetricRow label="allow filters" value={filtering?.whitelist_filter_count ?? '--'} />
          <MetricRow label="user rules" value={filtering?.user_rule_count ?? '--'} />
          <MetricRow label="update hours" value={filtering?.filters_update_interval_hours ?? '--'} />
          <div className="chip-row">
            <span className={`router-chip ${filtering?.safe_browsing_enabled === false ? 'warn' : 'ok'}`}>safe browsing {boolText(filtering?.safe_browsing_enabled)}</span>
            <span className={`router-chip ${filtering?.safe_search_enabled === false ? 'warn' : 'ok'}`}>safe search {boolText(filtering?.safe_search_enabled)}</span>
            <span className={`router-chip ${filtering?.parental_enabled ? 'ok' : 'warn'}`}>parental {boolText(filtering?.parental_enabled)}</span>
          </div>
        </section>

        <section>
          <h3>Security Summary</h3>
          <MetricRow label="generated" value={short(security?.generated_at)} />
          <MetricRow label="stats error" value={short(security?.stats_error, 'none')} />
          <MetricRow label="stats keys" value={stats ? Object.keys(stats).length : '--'} />
          <MetricRow label="live invokes" value={liveCount} />
          <div className="chip-row">
            {(security?.signals?.length ? security.signals : policySignals).slice(0, 6).map(signal => (
              <span className={`router-chip ${signal.endsWith('.off') ? 'warn' : 'ok'}`} key={signal}>{signal}</span>
            ))}
          </div>
        </section>
      </div>

      <div className="adguard-logger-strip">
        <button type="button" onClick={() => onOpen('adguard_security')}>
          <StatusChip state={risk === 'info' ? 'ok' : 'degraded'} />
          <strong>{securitySignals}</strong>
          <span>AdGuard security signals</span>
          <small>{short(security?.generated_at, 'waiting for security summary')}</small>
        </button>
        <button type="button" onClick={() => onOpen('logger_ops_dashboard')}>
          <StatusChip state={loggerRouteLive ? 'ok' : 'degraded'} />
          <strong>{incidentProof?.log_count ?? '--'}</strong>
          <span>Logger stream logs</span>
          <small>{incidentProof?.data_plane || 'amber_bus_only pending'}</small>
        </button>
        <button type="button" onClick={() => onOpen('logger_ops_dashboard')}>
          <StatusChip state={requestLinkReady ? 'ok' : 'degraded'} />
          <strong>{requestProof?.correlation_id_count ?? '--'}</strong>
          <span>request correlations</span>
          <small>{short(requestProof?.open_gate, 'request proof pending')}</small>
        </button>
        <button type="button" onClick={() => onOpen('adguard_security')}>
          <StatusChip state={loggerLinkState === 'linked' ? 'ok' : 'degraded'} label={`linkage ${loggerLinkState}`} />
          <strong>{loggerLinkState}</strong>
          <span>Logger security-event linkage</span>
          <small>Owner event/correlation contract required.</small>
        </button>
      </div>

      <div className="adguard-client-strip">
        {clientRows.length ? clientRows.map((client, index) => (
          <button type="button" key={`${client.name || 'client'}-${index}`} onClick={() => onOpen('adguard_clients')}>
            <strong>{short(client.name, 'client')}</strong>
            <span>{countArray(client.ids)} IDs</span>
            <small>filter {boolText(client.filtering_enabled)} / safe {boolText(client.safe_browsing_enabled)}</small>
          </button>
        )) : (
          <button type="button" onClick={() => onOpen('adguard_clients')}>
            <strong>0 clients</strong>
            <span>owner list live</span>
            <small>AdGuard returned an empty configured-client set.</small>
          </button>
        )}
      </div>

      <div className="adguard-query-strip">
        <button type="button" onClick={() => onOpen('adguard_querylog')}>
          <strong>{queryRows.length || '--'}</strong>
          <span>query-log rows</span>
          <small>{short(query?.result?.oldest || query?.result?.old_time, 'bounded owner default')}</small>
        </button>
        <button type="button" onClick={() => onOpen('adguard_status')}>
          <strong>read-only</strong>
          <span>operator posture</span>
          <small>No DNS, DHCP, filter, rewrite, upstream, or protection writes.</small>
        </button>
      </div>

      <div className="adguard-contract-strip">
        {blockedContracts.map(contract => (
          <section key={contract.title}>
            <div>
              <p className="eyebrow">{contract.owner}</p>
              <h3>{contract.title}</h3>
            </div>
            <StatusChip state="degraded" label={contract.state} />
            <MetricRow label="evidence" value={contract.evidence} />
            <MetricRow label="gate" value={contract.gate} />
          </section>
        ))}
      </div>

      <section
        className="perimeter-contract-handoff"
        data-perimeter-contract-open={blockedContracts.length}
        data-pfsense-contract="missing"
        data-mediadownloader-contract="missing"
        data-perimeter-controls="locked"
      >
        <div className="panel-head">
          <div>
            <p className="eyebrow">Owner Contracts</p>
            <h3>Perimeter and Media Handoff Ledger</h3>
          </div>
          <StatusChip state="degraded" label="contracts missing" />
        </div>
        <div className="perimeter-contract-grid">
          {perimeterHandoffPhases.map(phase => (
            <button type="button" key={phase.label} onClick={() => onOpen('adguard_security')}>
              <span>{phase.label}</span>
              <strong>{phase.detail}</strong>
              <small>pfSense {phase.pfsense} · MediaDownloader {phase.media}</small>
              <em>AdGuard evidence remains read-only</em>
            </button>
          ))}
        </div>
        <div className="chip-row">
          <span className="router-chip warn">pfSense owner contract missing</span>
          <span className="router-chip warn">MediaDownloader owner contract missing</span>
          <span className="router-chip ok">perimeter writes absent</span>
          <span className="router-chip ok">Amber Bus-only evidence</span>
        </div>
      </section>
    </article>
  );
}
