import type { ConsoleOverview, ConsoleSource } from '../types';
import { StatusChip } from '../components/StatusChip';

interface SourceReliabilityPanelProps {
  overview: ConsoleOverview | null;
  onOpen: (target: string) => void;
}

function ageSeconds(generatedAt?: string) {
  if (!generatedAt) return null;
  const when = Date.parse(generatedAt);
  if (Number.isNaN(when)) return null;
  return Math.max(0, Math.round((Date.now() - when) / 1000));
}

function groupedCount(sources: ConsoleSource[], key: keyof ConsoleSource) {
  return sources.reduce<Record<string, number>>((acc, source) => {
    const value = String(source[key] || 'unknown');
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function sourceTone(source: ConsoleSource) {
  if (source.state === 'ok') return 'ok';
  if (source.state === 'deferred') return 'degraded';
  return 'unavailable';
}

function isExpectedProgrammeBlocker(source: ConsoleSource) {
  const preview = source.preview || '';
  return (
    source.id === 'epic27_l9_status' ||
    source.id === 'epic27_windows_runtime_proof' ||
    preview.includes('windows_runtime_execution_open') ||
    preview.includes('"overall_status":"no_go"') ||
    preview.includes('"status":"no_go"')
  );
}

function previewField(source: ConsoleSource | undefined, field: string) {
  if (!source?.preview) return null;
  const match = source.preview.match(new RegExp(`"${field}"\\s*:\\s*"([^"]+)"`));
  return match?.[1] || null;
}

export function SourceReliabilityPanel({ overview, onOpen }: SourceReliabilityPanelProps) {
  const sources = overview?.sources || [];
  const counts = groupedCount(sources, 'state');
  const panelCounts = groupedCount(sources, 'panel');
  const nonBus = sources.filter(source => source.data_plane !== 'amber_bus_only');
  const detailReady = sources.filter(source => source.id && source.url).length;
  const unavailable = sources.filter(source => source.state !== 'ok' && source.state !== 'deferred');
  const expectedBlockers = unavailable.filter(isExpectedProgrammeBlocker);
  const degradedSignals = unavailable.filter(source => source.state === 'degraded' && !isExpectedProgrammeBlocker(source));
  const unexpectedUnavailable = unavailable.filter(source => source.state !== 'degraded' && !isExpectedProgrammeBlocker(source));
  const deferred = sources.filter(source => source.state === 'deferred');
  const slowest = [...sources]
    .filter(source => source.duration_ms > 0)
    .sort((a, b) => b.duration_ms - a.duration_ms)
    .slice(0, 5);
  const age = ageSeconds(overview?.generated_at);
  const busNative = sources.find(source => source.id === 'amber_bus_native_health');
  const busNativeState = previewField(busNative, 'overall_state') || busNative?.state || 'waiting';
  const busNativeTone = busNative ? sourceTone(busNative) : 'degraded';
  const busBacked = sources.filter(source => source.data_plane === 'amber_bus_only').length;
  const blastRadius = unexpectedUnavailable.length;

  return (
    <article className="panel wide reliability-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">L6 Reliability</p>
          <h2>Freshness and Click-Through Gates</h2>
        </div>
        <span className="hint">{age === null ? 'waiting for overview' : `${age}s since overview`}</span>
      </div>

      <div className="reliability-headline">
        <button type="button" onClick={() => onOpen('amber_bus_client_health')}>
          <strong>{overview?.summary.total ?? '--'}</strong>
          <span>shared sources</span>
          <small>{detailReady} detail contracts</small>
        </button>
        <button type="button" onClick={() => onOpen('amber_bus_client_health')}>
          <strong>{counts.ok || 0}</strong>
          <span>live now</span>
          <small>{nonBus.length ? `${nonBus.length} non-Bus` : 'Amber Bus only'}</small>
        </button>
        <button type="button" onClick={() => onOpen('amber_bus_overview')}>
          <strong>{counts.deferred || 0}</strong>
          <span>detail-only</span>
          <small>heavy sources are click-through</small>
        </button>
        <button type="button" onClick={() => onOpen(unexpectedUnavailable[0]?.id || expectedBlockers[0]?.id || 'amber_bus_client_health')}>
          <strong>{unexpectedUnavailable.length}</strong>
          <span>unexpected unavailable</span>
          <small>{expectedBlockers.length} expected blockers, {degradedSignals.length} degraded signals</small>
        </button>
      </div>

      <div className="reliability-grid">
        <section className="bus-resilience-section">
          <div className="panel-head">
            <h3>Bus Resilience Ledger</h3>
            <StatusChip state={blastRadius ? 'unavailable' : busNativeTone} label={blastRadius ? 'blast radius' : busNativeState} />
          </div>
          <div className="bus-resilience-ledger">
            <button type="button" onClick={() => onOpen('amber_bus_native_health')}>
              <span>native edge</span>
              <strong>{busNativeState}</strong>
              <small>HTTP {busNative?.http_status ?? '--'} · {busNative?.duration_ms ?? '--'}ms</small>
            </button>
            <button type="button" onClick={() => onOpen(unexpectedUnavailable[0]?.id || 'amber_bus_native_health')}>
              <span>source blast radius</span>
              <strong>{blastRadius}</strong>
              <small>{blastRadius ? 'unexpected sources unavailable' : 'no unexpected outage now'}</small>
            </button>
            <button type="button" onClick={() => onOpen('amber_bus_overview')}>
              <span>detail-only load</span>
              <strong>{deferred.length}</strong>
              <small>heavy sources deferred</small>
            </button>
            <button type="button" onClick={() => onOpen(expectedBlockers[0]?.id || 'epic27_l9_status')}>
              <span>expected blockers</span>
              <strong>{expectedBlockers.length}</strong>
              <small>programme no-go, not outage</small>
            </button>
            <button type="button" onClick={() => onOpen('amber_bus_client_health')}>
              <span>Bus-only coverage</span>
              <strong>{busBacked}</strong>
              <small>{nonBus.length ? `${nonBus.length} non-Bus` : 'all operational sources'}</small>
            </button>
          </div>
        </section>

        <section>
          <div className="panel-head">
            <h3>Expected Programme Blockers</h3>
            <StatusChip state={expectedBlockers.length ? 'degraded' : 'ok'} label={expectedBlockers.length ? 'l9 no-go' : 'clear'} />
          </div>
          <div className="reliability-list">
            {expectedBlockers.slice(0, 8).map(source => (
              <button type="button" key={source.id} onClick={() => onOpen(source.id)}>
                <StatusChip state="degraded" label="expected" />
                <b>{source.id}</b>
                <span>{source.owner} · HTTP {source.http_status}</span>
              </button>
            ))}
            {!expectedBlockers.length && <span className="instrument on">no expected programme blockers in current overview</span>}
          </div>
        </section>

        <section>
          <div className="panel-head">
            <h3>Unexpected Source Outages</h3>
            <StatusChip state={unexpectedUnavailable.length ? 'unavailable' : 'ok'} label={unexpectedUnavailable.length ? 'investigate' : 'clear'} />
          </div>
          <div className="reliability-list">
            {unexpectedUnavailable.slice(0, 8).map(source => (
              <button type="button" key={source.id} onClick={() => onOpen(source.id)}>
                <StatusChip state={sourceTone(source)} label={source.state} />
                <b>{source.id}</b>
                <span>{source.owner} · HTTP {source.http_status}</span>
              </button>
            ))}
            {!unexpectedUnavailable.length && <span className="instrument on">no unexpected unavailable sources in current overview</span>}
          </div>
        </section>

        <section>
          <div className="panel-head">
            <h3>Owner Degraded Signals</h3>
            <StatusChip state={degradedSignals.length ? 'degraded' : 'ok'} label={degradedSignals.length ? 'live degraded' : 'clear'} />
          </div>
          <div className="reliability-list">
            {degradedSignals.slice(0, 8).map(source => (
              <button type="button" key={source.id} onClick={() => onOpen(source.id)}>
                <StatusChip state="degraded" label="degraded" />
                <b>{source.id}</b>
                <span>{source.owner} · HTTP {source.http_status}</span>
              </button>
            ))}
            {!degradedSignals.length && <span className="instrument on">no degraded live owner signals in current overview</span>}
          </div>
        </section>

        <section>
          <div className="panel-head">
            <h3>Deferred Sources</h3>
            <StatusChip state="degraded" label={`${deferred.length} detail`} />
          </div>
          <div className="reliability-list">
            {deferred.slice(0, 8).map(source => (
              <button type="button" key={source.id} onClick={() => onOpen(source.id)}>
                <StatusChip state="degraded" label="deferred" />
                <b>{source.id}</b>
                <span>{source.preview}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="panel-head">
            <h3>Slowest Detail Evidence</h3>
            <StatusChip state="ok" label="sampled" />
          </div>
          <div className="reliability-list">
            {slowest.map(source => (
              <button type="button" key={source.id} onClick={() => onOpen(source.id)}>
                <StatusChip state={sourceTone(source)} label={`${source.duration_ms}ms`} />
                <b>{source.id}</b>
                <span>{source.owner} · {source.transport || 'transport?'}</span>
              </button>
            ))}
            {!slowest.length && <span className="instrument off">overview cache has no sampled latencies yet</span>}
          </div>
        </section>
      </div>

      <div className="reliability-panel-strip">
        {Object.entries(panelCounts).map(([panel, count]) => (
          <span key={panel}>
            <b>{count}</b>
            {panel}
          </span>
        ))}
      </div>
    </article>
  );
}
