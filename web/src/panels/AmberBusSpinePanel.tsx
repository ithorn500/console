import { Background, Controls, Handle, MiniMap, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react';
import { useEffect, useMemo, useState } from 'react';
import { fetchSource } from '../api/consoleApi';
import { MetricRow } from '../components/MetricRow';
import { StatusChip } from '../components/StatusChip';
import type {
  AmberBusApplication,
  AmberBusApplicationsPayload,
  AmberBusConsumeMenuPayload,
  AmberBusContractsPayload,
  AmberBusClientHealthPayload,
  AmberBusFunctionalityPayload,
  AmberBusNativeHealthPayload,
  SourceDetail
} from '../types';

interface AmberBusSpinePanelProps {
  onOpen: (target: string) => void;
}

type BusNodeData = {
  label: string;
  metric: string | number;
  subtitle: string;
  tone: string;
  target: string;
  onOpen: (target: string) => void;
};

function BusNode({ data }: NodeProps<Node<BusNodeData>>) {
  return (
    <button className={`bus-node ${data.tone}`} type="button" onClick={() => data.onOpen(data.target)}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <strong>{data.metric}</strong>
      <span>{data.label}</span>
      <small>{data.subtitle}</small>
    </button>
  );
}

const nodeTypes = { bus: BusNode };

function appLabel(app: AmberBusApplication) {
  return app.display_name || app.app_id;
}

function appMode(app: AmberBusApplication) {
  return app.bus?.mode || 'unknown';
}

function directApiCount(apps: AmberBusApplication[]) {
  return apps.filter(app => app.bus?.exposure?.direct_api_enabled).length;
}

function invokeCount(apps: AmberBusApplication[]) {
  return apps.filter(app => app.bus?.exposure?.bus_invoke_enabled).length;
}

function staleFrameworkCount(apps: AmberBusApplication[]) {
  return apps.filter(app => app.client_framework_status && app.client_framework_status !== 'current').length;
}

function functionCount(app: AmberBusApplication) {
  return app.functionality_count || 0;
}

function totalFunctions(apps: AmberBusApplication[]) {
  return apps.reduce((sum, app) => sum + functionCount(app), 0);
}

function totalInterfaces(apps: AmberBusApplication[]) {
  return apps.reduce((sum, app) => sum + (app.published_interface_count || 0), 0);
}

function unionTransports(apps: AmberBusApplication[]) {
  return Array.from(new Set(apps.flatMap(app => app.transports || []))).sort();
}

function capabilityRows(apps: AmberBusApplication[]) {
  return apps
    .flatMap(app => (app.capabilities || []).slice(0, 4).map(capability => ({ app, capability })))
    .slice(0, 10);
}

function manifestRows(apps: AmberBusApplication[]) {
  return [...apps]
    .sort((a, b) => functionCount(b) - functionCount(a) || appLabel(a).localeCompare(appLabel(b)))
    .slice(0, 14);
}

function requiredBindings(app: AmberBusApplication) {
  return app.bus?.service_bindings?.required || app.service_bindings?.required || [];
}

function optionalBindings(app: AmberBusApplication) {
  return app.bus?.service_bindings?.optional || app.service_bindings?.optional || [];
}

function bindingRows(apps: AmberBusApplication[]) {
  return apps
    .filter(app => requiredBindings(app).length || optionalBindings(app).length || app.bus?.exposure?.direct_api_enabled || app.bus?.exposure?.bus_invoke_enabled)
    .sort((a, b) => {
      const aRisk = Number(Boolean(a.bus?.exposure?.direct_api_enabled)) + requiredBindings(a).length;
      const bRisk = Number(Boolean(b.bus?.exposure?.direct_api_enabled)) + requiredBindings(b).length;
      return bRisk - aRisk || appLabel(a).localeCompare(appLabel(b));
    })
    .slice(0, 10);
}

function short(value: unknown, fallback = '--') {
  if (value === null || value === undefined || value === '') return fallback;
  const text = String(value);
  return text.length > 88 ? `${text.slice(0, 85)}...` : text;
}

function tiny(value: unknown, fallback = '--') {
  if (value === null || value === undefined || value === '') return fallback;
  const text = String(value);
  return text.length > 42 ? `${text.slice(0, 39)}...` : text;
}

function ageLabel(value?: string) {
  if (!value) return '--';
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return 'invalid timestamp';
  const ageMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(ageMs / 60000);
  if (minutes < 1) return 'fresh now';
  if (minutes < 120) return `${minutes}m old`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h old`;
}

function manifestUpdatedAt(app: AmberBusApplication) {
  return app.manifest_source?.runtime_manifest?.updated_at || app.manifest_source?.source_manifest?.updated_at || '';
}

export function AmberBusSpinePanel({ onOpen }: AmberBusSpinePanelProps) {
  const [appsSource, setAppsSource] = useState<SourceDetail<AmberBusApplicationsPayload> | null>(null);
  const [functionalitySource, setFunctionalitySource] = useState<SourceDetail<AmberBusFunctionalityPayload> | null>(null);
  const [contractsSource, setContractsSource] = useState<SourceDetail<AmberBusContractsPayload> | null>(null);
  const [consumeMenuSource, setConsumeMenuSource] = useState<SourceDetail<AmberBusConsumeMenuPayload> | null>(null);
  const [healthSource, setHealthSource] = useState<SourceDetail<AmberBusClientHealthPayload> | null>(null);
  const [nativeHealthSource, setNativeHealthSource] = useState<SourceDetail<AmberBusNativeHealthPayload> | null>(null);
  const [overviewSource, setOverviewSource] = useState<SourceDetail<Record<string, unknown>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTick, setLastTick] = useState('--');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [apps, functionality, contracts, consumeMenu, health, nativeHealth, overview] = await Promise.all([
          fetchSource<AmberBusApplicationsPayload>('amber_bus_apps', { loggerEvidence: false }),
          fetchSource<AmberBusFunctionalityPayload>('amber_bus_functionality', { loggerEvidence: false }),
          fetchSource<AmberBusContractsPayload>('amber_bus_contracts', { loggerEvidence: false }),
          fetchSource<AmberBusConsumeMenuPayload>('amber_bus_consume_menu', { loggerEvidence: false }),
          fetchSource<AmberBusClientHealthPayload>('amber_bus_client_health', { loggerEvidence: false }),
          fetchSource<AmberBusNativeHealthPayload>('amber_bus_native_health', { loggerEvidence: false }),
          fetchSource<Record<string, unknown>>('amber_bus_overview', { loggerEvidence: false })
        ]);
        if (cancelled) return;
        setAppsSource(apps);
        setFunctionalitySource(functionality);
        setContractsSource(contracts);
        setConsumeMenuSource(consumeMenu);
        setHealthSource(health);
        setNativeHealthSource(nativeHealth);
        setOverviewSource(overview);
        setLastTick(new Date().toLocaleTimeString());
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

  const apps = appsSource?.payload?.applications || [];
  const rawFunctions = functionalitySource?.payload?.functionalities || [];
  const rawInterfaces = contractsSource?.payload?.interfaces || [];
  const consumeSummary = consumeMenuSource?.payload?.summary;
  const consumeSections = consumeMenuSource?.payload?.menu_sections || [];
  const clientRecords = healthSource?.payload?.records || [];
  const nativeHealth = nativeHealthSource?.payload;
  const socketState = nativeHealth?.socket_state;
  const fdPressure = nativeHealth?.fd_pressure;
  const activePressure = nativeHealth?.active_client_pressure;
  const closeWait = Number(socketState?.close_wait || 0);
  const establishedSockets = Number(socketState?.established || 0);
  const timeWaitSockets = Number(socketState?.time_wait || 0);
  const socketTone = closeWait > 0 || socketState?.state === 'degraded' ? 'degraded' : nativeHealthSource?.ok ? 'ok' : 'unavailable';
  const sortedApps = [...apps].sort((a, b) => functionCount(b) - functionCount(a));
  const transports = unionTransports(apps);
  const capabilities = capabilityRows(sortedApps);
  const functionsTotal = totalFunctions(apps);
  const functionsCatalogTotal = rawFunctions.length || functionalitySource?.payload?.count || functionsTotal;
  const interfacesTotal = rawInterfaces.length || contractsSource?.payload?.count || totalInterfaces(apps);
  const contractRefsTotal = apps.reduce((sum, app) => sum + (app.contracts?.length || 0), 0);
  const directFunctionCount = directApiCount(apps);
  const topFunctions = manifestRows(apps);
  const bindingMatrix = bindingRows(apps);
  const requiredBindingCount = apps.reduce((sum, app) => sum + requiredBindings(app).length, 0);
  const optionalBindingCount = apps.reduce((sum, app) => sum + optionalBindings(app).length, 0);
  const missingManifestTimestamps = apps.filter(app => !manifestUpdatedAt(app)).length;
  const oldestManifestUpdatedAt = apps
    .map(manifestUpdatedAt)
    .filter(Boolean)
    .sort()[0] || '';
  const freshnessRows = [
    {
      id: 'amber_bus_native_health',
      label: 'native socket health',
      source: nativeHealthSource,
      generatedAt: nativeHealth?.generated_at,
      schema: nativeHealth?.schema,
      count: socketState?.total_for_listen_port || 0,
      expected: 'amber.bus.health.v1'
    },
    {
      id: 'amber_bus_apps',
      label: 'app manifest catalogue',
      source: appsSource,
      generatedAt: appsSource?.payload?.generated_at,
      schema: appsSource?.payload?.schema,
      count: apps.length,
      expected: 'amber.application.catalog.v1'
    },
    {
      id: 'amber_bus_functionality',
      label: 'raw function catalogue',
      source: functionalitySource,
      generatedAt: functionalitySource?.payload?.generated_at,
      schema: functionalitySource?.payload?.schema,
      count: functionsCatalogTotal,
      expected: 'amber.functionality.catalog.v1'
    },
    {
      id: 'amber_bus_contracts',
      label: 'raw interface contracts',
      source: contractsSource,
      generatedAt: contractsSource?.payload?.generated_at,
      schema: contractsSource?.payload?.schema,
      count: interfacesTotal,
      expected: 'amber.interface.catalog.v1'
    },
    {
      id: 'amber_bus_consume_menu',
      label: 'consume menu',
      source: consumeMenuSource,
      generatedAt: consumeMenuSource?.payload?.generated_at,
      schema: consumeMenuSource?.payload?.schema,
      count: consumeSummary?.functionalities || 0,
      expected: 'amber.consume.menu.model.v1'
    }
  ];

  const flow = useMemo(() => {
    const topApps = sortedApps.slice(0, 8);
    const nodes: Node<BusNodeData>[] = [
      {
        id: 'bus',
        type: 'bus',
        position: { x: 390, y: 160 },
        data: {
          label: 'Amber Bus',
          metric: apps.length || '--',
          subtitle: 'registered apps',
          tone: 'core',
          target: 'amber_bus_overview',
          onOpen
        }
      },
      {
        id: 'consume',
        type: 'bus',
        position: { x: 390, y: 20 },
        data: {
          label: 'Consume Menu',
          metric: functionsCatalogTotal || '--',
          subtitle: 'discoverable functions',
          tone: 'cyan',
          target: 'amber_bus_apps',
          onOpen
        }
      },
      {
        id: 'health',
        type: 'bus',
        position: { x: 390, y: 320 },
        data: {
          label: 'Client Health',
          metric: clientRecords.length,
          subtitle: 'reported clients',
          tone: clientRecords.length ? 'green' : 'amber',
          target: 'amber_bus_client_health',
          onOpen
        }
      },
      ...topApps.map((app, index) => {
        const left = index % 2 === 0;
        const row = Math.floor(index / 2);
        return {
          id: app.app_id,
          type: 'bus',
          position: { x: left ? 25 : 745, y: 20 + row * 112 },
          data: {
            label: appLabel(app),
            metric: functionCount(app),
            subtitle: `${appMode(app)} · ${app.bus?.connector?.status || 'registered'}`,
            tone: appMode(app) === 'production' ? 'green' : app.bus?.exposure?.bus_invoke_enabled ? 'violet' : 'amber',
            target: 'amber_bus_apps',
            onOpen
          }
        } satisfies Node<BusNodeData>;
      })
    ];
    const edges: Edge[] = [
      { id: 'consume-bus', source: 'consume', target: 'bus', animated: true, label: 'discover' },
      { id: 'bus-health', source: 'bus', target: 'health', animated: clientRecords.length > 0, label: 'report' },
      ...topApps.map(app => ({
        id: `bus-${app.app_id}`,
        source: 'bus',
        target: app.app_id,
        animated: Boolean(app.bus?.exposure?.bus_invoke_enabled),
        label: appMode(app)
      }))
    ];
    return { nodes, edges };
  }, [apps.length, clientRecords.length, functionsCatalogTotal, onOpen, sortedApps]);

  return (
    <article className="panel wide bus-spine-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Amber Bus</p>
          <h2>Living Spine, Manifest, and Function Graph</h2>
        </div>
        <span className="hint">30s refresh · Bus-owned endpoints · last {lastTick}</span>
      </div>

      {error && <div className="router-error">{error}</div>}

      <div className="bus-spine-metrics">
        <button type="button" onClick={() => onOpen('amber_bus_apps')}>
          <strong>{apps.length || '--'}</strong>
          <span>apps</span>
        </button>
        <button type="button" onClick={() => onOpen('amber_bus_apps')}>
          <strong>{functionsCatalogTotal || '--'}</strong>
          <span>raw functions</span>
        </button>
        <button type="button" onClick={() => onOpen('amber_bus_apps')}>
          <strong>{invokeCount(apps)}</strong>
          <span>invoke enabled</span>
        </button>
        <button type="button" onClick={() => onOpen('amber_bus_apps')}>
          <strong>{directApiCount(apps)}</strong>
          <span>direct APIs exposed</span>
        </button>
        <button type="button" onClick={() => onOpen('amber_bus_apps')}>
          <strong>{staleFrameworkCount(apps)}</strong>
          <span>framework drift</span>
        </button>
        <button type="button" onClick={() => onOpen('amber_bus_client_health')}>
          <strong>{clientRecords.length}</strong>
          <span>client health records</span>
        </button>
        <button type="button" onClick={() => onOpen('amber_bus_native_health')}>
          <strong>{closeWait}</strong>
          <span>CLOSE-WAIT sockets</span>
        </button>
      </div>

      <div className="bus-contract-strip">
        <button type="button" onClick={() => onOpen('amber_bus_functionality')}>
          <span>raw function catalogue</span>
          <strong>{functionsCatalogTotal || '--'}</strong>
          <small>{rawFunctions.length ? 'live /api/bus/functionality' : `${apps.length} manifest-derived`} · {directFunctionCount} direct API migration flags</small>
        </button>
        <button type="button" onClick={() => onOpen('amber_bus_contracts')}>
          <span>raw interface contracts</span>
          <strong>{interfacesTotal || '--'}</strong>
          <small>{contractRefsTotal} manifest contract refs · live /api/bus/contracts</small>
        </button>
        <button type="button" onClick={() => onOpen('amber_bus_consume_menu')}>
          <span>consume menu</span>
          <strong>{consumeSummary?.mqtt_topics ?? '--'}</strong>
          <small>{consumeSummary?.applications ?? apps.length} apps · {consumeSummary?.functionalities ?? functionsCatalogTotal} user-selectable capabilities</small>
        </button>
        <button type="button" onClick={() => onOpen('amber_bus_apps')}>
          <span>service bindings</span>
          <strong>{requiredBindingCount}/{optionalBindingCount}</strong>
          <small>required / optional owner dependencies declared in app manifests</small>
        </button>
      </div>

      <section className="bus-function-drilldown bus-freshness-gates">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Freshness Gates</p>
            <h3>Source age, schema integrity, and manifest timestamp proof</h3>
          </div>
          <StatusChip state={missingManifestTimestamps ? 'degraded' : 'ok'} label={missingManifestTimestamps ? 'per-manifest timestamp absent' : 'timestamped'} />
        </div>
        <div className="bus-invoke-grid">
          {freshnessRows.map(row => {
            const schemaOk = row.schema === row.expected;
            const countOk = row.count > 0;
            const sourceOk = Boolean(row.source?.ok && row.source.http_status === 200);
            return (
              <button type="button" key={row.id} onClick={() => onOpen(row.id)}>
                <span>{row.label}</span>
                <strong>{ageLabel(row.generatedAt)}</strong>
                <small>{tiny(row.generatedAt, 'generated_at absent')} · {row.source?.duration_ms ?? '--'}ms source detail</small>
                <div className="chip-row">
                  <span className={`router-chip ${sourceOk ? 'ok' : 'warn'}`}>{row.source?.http_status || '--'} source</span>
                  <span className={`router-chip ${schemaOk ? 'ok' : 'warn'}`}>{schemaOk ? 'schema ok' : 'schema drift'}</span>
                  <span className={`router-chip ${countOk ? 'ok' : 'warn'}`}>{row.count || '--'} records</span>
                </div>
              </button>
            );
          })}
          <button type="button" onClick={() => onOpen('amber_bus_apps')}>
            <span>per-manifest timestamp proof</span>
            <strong>{missingManifestTimestamps ? 'open gate' : 'green'}</strong>
            <small>{missingManifestTimestamps ? `${missingManifestTimestamps} app manifests missing file-age evidence.` : `oldest manifest ${ageLabel(oldestManifestUpdatedAt)} · ${tiny(oldestManifestUpdatedAt)}`}</small>
            <div className="chip-row">
              <span className={`router-chip ${staleFrameworkCount(apps) ? 'warn' : 'ok'}`}>{staleFrameworkCount(apps)} framework drift</span>
              <span className={`router-chip ${missingManifestTimestamps ? 'warn' : 'ok'}`}>{missingManifestTimestamps ? 'manifest-age field absent' : 'manifest-age proof live'}</span>
              <span className="router-chip ok">owner Bus payload visible</span>
            </div>
          </button>
        </div>
      </section>

      <section className="bus-function-drilldown bus-socket-pressure">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Owner-Client Socket Pressure</p>
            <h3>Native Bus listener pressure and CLOSE-WAIT proof</h3>
          </div>
          <StatusChip state={socketTone} label={closeWait > 0 ? `${closeWait} close-wait` : nativeHealthSource?.ok ? 'clear' : 'waiting'} />
        </div>
        <div className="bus-invoke-grid">
          <button type="button" onClick={() => onOpen('amber_bus_native_health')}>
            <span>listen port</span>
            <strong>{socketState?.listen_port ?? '--'}</strong>
            <small>{nativeHealth?.service || 'amber-bus-native'} · {nativeHealth?.overall_state || 'health pending'} · {nativeHealthSource?.duration_ms ?? '--'}ms source detail</small>
            <div className="chip-row">
              <span className={`router-chip ${nativeHealthSource?.ok ? 'ok' : 'warn'}`}>/api/bus/health {nativeHealthSource?.http_status || '--'}</span>
              <span className={`router-chip ${socketState?.schema === 'amber.bus.native_socket_state.v1' ? 'ok' : 'warn'}`}>{socketState?.schema || 'socket schema pending'}</span>
              <span className={`router-chip ${nativeHealthSource?.data_plane === 'amber_bus_only' ? 'ok' : 'warn'}`}>Amber Bus only</span>
            </div>
          </button>
          <button type="button" onClick={() => onOpen('amber_bus_native_health')}>
            <span>socket states</span>
            <strong>{socketState?.total_for_listen_port ?? '--'}</strong>
            <small>{socketState?.listen ?? '--'} listen · {establishedSockets} established · {timeWaitSockets} time-wait</small>
            <div className="chip-row">
              <span className={`router-chip ${closeWait > 0 ? 'hot' : 'ok'}`}>CLOSE-WAIT {closeWait}</span>
              <span className="router-chip">{establishedSockets} established</span>
              <span className="router-chip">{timeWaitSockets} TIME-WAIT</span>
            </div>
          </button>
          <button type="button" onClick={() => onOpen('amber_bus_native_health')}>
            <span>fd and accept queue</span>
            <strong>{fdPressure?.open_fds ?? '--'}</strong>
            <small>queue {fdPressure?.accept_queue_depth ?? '--'} / {fdPressure?.accept_queue_max ?? '--'} · soft limit {fdPressure?.nofile_soft ?? '--'}</small>
            <div className="chip-row">
              <span className="router-chip">{fdPressure?.accept_fd_pressure_events ?? 0} fd sheds</span>
              <span className="router-chip">{fdPressure?.accept_queue_rejections ?? 0} queue rejects</span>
              <span className={`router-chip ${nativeHealth?.overall_state === 'healthy' ? 'ok' : nativeHealth?.overall_state === 'degraded' ? 'warn' : 'hot'}`}>{nativeHealth?.overall_state || 'unknown'}</span>
            </div>
          </button>
          <button type="button" onClick={() => onOpen('amber_bus_native_health')}>
            <span>active request paths</span>
            <strong>{activePressure?.active_count ?? '--'}</strong>
            <small>longest {activePressure?.longest_active_ms ?? '--'}ms · closed peers {activePressure?.closed_peer_active_count ?? '--'} active / {activePressure?.closed_peer_seen_count ?? 0} seen</small>
            <div className="chip-row">
              <span className={`router-chip ${activePressure?.closed_peer_active_count ? 'hot' : 'ok'}`}>active closed peers {activePressure?.closed_peer_active_count ?? '--'}</span>
              <span className="router-chip">{activePressure?.closed_peer_dropped_count ?? 0} pre-route drops</span>
              <span className={`router-chip ${activePressure?.schema === 'amber.bus.native_active_client_pressure.v1' ? 'ok' : 'warn'}`}>{activePressure?.schema || 'active schema pending'}</span>
            </div>
          </button>
        </div>
        {Boolean(activePressure?.sample?.length) && (
          <div className="bus-function-list socket-request-list">
            {activePressure?.sample.slice(0, 6).map(item => (
              <button type="button" key={`${item.fd}-${item.peer}-${item.age_ms}`} onClick={() => onOpen('amber_bus_native_health')}>
                <b>{short(item.path || item.target || 'pending request')}</b>
                <span>{item.peer || 'unknown peer'} · {item.lane || 'lane pending'} · {item.state || 'state pending'} · {item.age_ms}ms</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="bus-spine-stage">
        <div className="bus-flow-shell">
          <ReactFlow nodes={flow.nodes} edges={flow.edges} nodeTypes={nodeTypes} fitView minZoom={0.45} maxZoom={1.5} proOptions={{ hideAttribution: true }}>
            <Background color="#355a70" gap={20} />
            <MiniMap pannable zoomable />
            <Controls />
          </ReactFlow>
        </div>

        <section className="bus-spine-side">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Transport</p>
              <h3>Consume surface</h3>
            </div>
            <StatusChip state={appsSource?.ok ? 'ok' : 'degraded'} label={appsSource?.ok ? 'live' : 'waiting'} />
          </div>
          <MetricRow label="raw interfaces" value={interfacesTotal || '--'} />
          <MetricRow label="registered apps" value={apps.length || '--'} />
          <MetricRow label="management" value={String((overviewSource?.payload?.summary as { status?: string } | undefined)?.status || 'unknown')} />
          <div className="chip-row">
            {transports.map(item => <span className="router-chip" key={item}>{item}</span>)}
          </div>
          <div className="bus-function-list">
            {capabilities.map(({ app, capability }) => (
              <button type="button" key={`${app.app_id}-${capability}`} onClick={() => onOpen('amber_bus_apps')}>
                <b>{capability.replace(/_/g, ' ')}</b>
                <span>{appLabel(app)} · {appMode(app)} · {app.bus?.exposure?.bus_invoke_enabled ? 'invoke' : 'catalog only'}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="bus-function-drilldown">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Function Contracts</p>
            <h3>Invoke paths, manifests, and linked interfaces</h3>
          </div>
          <button type="button" onClick={() => onOpen('amber_bus_functionality')}>Function Catalog</button>
        </div>
        <div className="chip-row">
          <span className={`router-chip ${functionalitySource?.ok ? 'ok' : 'warn'}`}>/api/bus/functionality {functionalitySource?.http_status || '--'}</span>
          <span className={`router-chip ${contractsSource?.ok ? 'ok' : 'warn'}`}>/api/bus/contracts {contractsSource?.http_status || '--'}</span>
          <span className={`router-chip ${consumeMenuSource?.ok ? 'ok' : 'warn'}`}>/api/bus/consume/menu {consumeMenuSource?.http_status || '--'}</span>
        </div>
        <div className="bus-function-grid">
          {(rawFunctions.length ? rawFunctions.slice(0, 14) : topFunctions).map(item => {
            const isRaw = 'function_id' in item;
            const direct = isRaw ? Boolean(item.bus_invocation?.direct_api_enabled) : Boolean(item.bus?.exposure?.direct_api_enabled);
            return (
              <button type="button" key={isRaw ? item.function_id : item.app_id} onClick={() => onOpen(isRaw ? 'amber_bus_functionality' : 'amber_bus_apps')}>
                <span>{isRaw ? item.stability || 'catalog' : appMode(item)}</span>
                <strong>{short(isRaw ? item.name : appLabel(item))}</strong>
                <small>{short(item.summary)}</small>
                <div className="chip-row">
                  <span className="router-chip ok">{isRaw ? short(item.app_display_name || item.app_id) : `${functionCount(item)} functions`}</span>
                  <span className={`router-chip ${direct ? 'warn' : 'ok'}`}>{direct ? 'direct migration flag' : 'bus-only path'}</span>
                  <span className="router-chip">{isRaw ? item.linked_interfaces?.length || 0 : item.published_interface_count || 0} interfaces</span>
                  <span className="router-chip">{isRaw ? item.linked_contracts?.length || 0 : item.contracts?.length || 0} contracts</span>
                  {isRaw && item.bus_invocation?.invoke_path && <span className="router-chip">{short(item.bus_invocation.invoke_path, 'invoke path')}</span>}
                  {!isRaw && (item.capabilities || []).slice(0, 2).map(capability => <span className="router-chip" key={capability}>{short(capability, 'capability')}</span>)}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="bus-function-drilldown">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Interface Catalogue</p>
            <h3>Linked contracts, direct access, and consume prompts</h3>
          </div>
          <button type="button" onClick={() => onOpen('amber_bus_contracts')}>Contracts</button>
        </div>
        <div className="bus-function-grid">
          {rawInterfaces.slice(0, 10).map(item => (
            <button type="button" key={item.interface_id} onClick={() => onOpen('amber_bus_contracts')}>
              <span>{item.kind || 'interface'} · {item.stability || 'unknown'}</span>
              <strong>{short(item.interface_id)}</strong>
              <small>{short(item.summary)}</small>
              <div className="chip-row">
                <span className="router-chip ok">{short(item.app_display_name || item.app_id)}</span>
                <span className={`router-chip ${item.direct_access?.enabled ? 'warn' : 'ok'}`}>{item.direct_access?.enabled ? 'direct migration flag' : 'bus managed'}</span>
                <span className="router-chip">{item.paths?.length || 0} paths</span>
                {item.bus_path && <span className="router-chip">{short(item.bus_path)}</span>}
              </div>
            </button>
          ))}
          {consumeSections.flatMap(section => section.items.slice(0, 4).map(item => ({ section, item }))).slice(0, 6).map(({ section, item }) => (
            <button type="button" key={`${section.id}-${item.app_id || item.id || item.label}`} onClick={() => onOpen('amber_bus_consume_menu')}>
              <span>{section.title}</span>
              <strong>{short(item.label)}</strong>
              <small>{short(item.summary)}</small>
              <div className="chip-row">
                <span className="router-chip ok">{item.functionality_count || 0} functions</span>
                <span className="router-chip">{item.interface_count || 0} interfaces</span>
                <span className="router-chip">{item.topic_count || 0} topics</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="bus-invoke-matrix">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Invoke and Binding Matrix</p>
            <h3>Owner dependencies, direct API migration flags, and manifest gates</h3>
          </div>
          <StatusChip state={directFunctionCount ? 'degraded' : 'ok'} label={directFunctionCount ? `${directFunctionCount} direct` : 'bus-only'} />
        </div>
        <div className="bus-invoke-grid">
          {bindingMatrix.map(app => {
            const required = requiredBindings(app);
            const optional = optionalBindings(app);
            const direct = Boolean(app.bus?.exposure?.direct_api_enabled);
            const invoke = Boolean(app.bus?.exposure?.bus_invoke_enabled);
            return (
              <button type="button" key={app.app_id} onClick={() => onOpen('amber_bus_apps')}>
                <div className="bus-invoke-head">
                  <StatusChip state={direct ? 'degraded' : invoke ? 'ok' : 'unavailable'} label={direct ? 'migration' : invoke ? 'invoke' : 'catalog'} />
                  <div>
                    <strong>{short(appLabel(app), app.app_id)}</strong>
                    <span>{appMode(app)} · {app.bus?.connector?.status || 'connector state unknown'}</span>
                  </div>
                </div>
                <div className="bus-invoke-facts">
                  <span>{required.length} required</span>
                  <span>{optional.length} optional</span>
                  <span>{app.contracts?.length || 0} contracts</span>
                  <span>{app.published_interface_count || 0} interfaces</span>
                </div>
                <div className="bus-binding-strip">
                  {[...required, ...optional].slice(0, 4).map(binding => (
                    <span key={`${app.app_id}-${binding.binding_id || binding.capability}`}>
                      <b>{tiny(binding.binding_id || binding.capability, 'binding')}</b>
                      {tiny(binding.capability || binding.purpose, 'capability')}
                    </span>
                  ))}
                  {!required.length && !optional.length && <span><b>no binding rows</b>manifest has no dependency declaration</span>}
                </div>
                <small>{direct ? short(app.bus?.exposure?.direct_api_policy, 'direct API still exposed during migration') : 'Bus invoke path is the advertised production access route.'}</small>
              </button>
            );
          })}
        </div>
      </section>
    </article>
  );
}
