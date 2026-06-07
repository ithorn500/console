import { useEffect, useState } from 'react';
import { fetchSource } from '../api/consoleApi';
import type { ConsoleOverview, ConsoleSource } from '../types';
import { StatusChip } from '../components/StatusChip';

interface E31NativeSpinePanelProps {
  overview: ConsoleOverview | null;
  onOpen: (target: string) => void;
}

const e31Rows = [
  {
    id: 'e31_native_spine_status',
    label: 'Native spine',
    expectation: 'standalone route parity and no Python loopback'
  },
  {
    id: 'e31_python_retirement_status',
    label: 'Python retirement',
    expectation: 'no hidden resident Python production path'
  },
  {
    id: 'memorr_e32_status',
    label: 'E32 native authority',
    expectation: 'Memorr owner truth promoted to native MDBX through Amber Bus'
  },
  {
    id: 'e31_modules_status',
    label: 'Native modules',
    expectation: 'module lifecycle visible through Amber Bus'
  },
  {
    id: 'e31_native_traffic_status',
    label: 'Traffic freshness',
    expectation: 'body-free route-seen and route-response evidence'
  },
  {
    id: 'e31_central_io_status',
    label: 'Central_IO pressure',
    expectation: 'bounded payload leases and pressure budget'
  },
  {
    id: 'e31_concierge_internet_status',
    label: 'Concierge Internet',
    expectation: 'DEMand-only mobile access, no raw owner exposure'
  }
];

const closureRows = ['e31_native_spine_status', 'e31_python_retirement_status', 'memorr_e32_status'];

function byId(overview: ConsoleOverview | null): Record<string, ConsoleSource> {
  return Object.fromEntries((overview?.sources || []).map(source => [source.id, source]));
}

function stateOf(source?: ConsoleSource) {
  return source?.state || 'unavailable';
}

function previewOf(source?: ConsoleSource) {
  if (!source) return 'source missing from shared Console catalog';
  if (source.state === 'deferred') return 'click through to query the owner-backed Amber Bus route';
  return source.preview || `${source.http_status || '--'} from ${source.url}`;
}

export function E31NativeSpinePanel({ overview, onOpen }: E31NativeSpinePanelProps) {
  const [closureDetails, setClosureDetails] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const results = await Promise.allSettled(closureRows.map(id => fetchSource(id, { loggerEvidence: false })));
      if (cancelled) return;
      const next: Record<string, string> = {};
      closureRows.forEach((id, index) => {
        const result = results[index];
        next[id] = result.status === 'fulfilled' && result.value.ok ? 'ok' : 'unavailable';
      });
      setClosureDetails(next);
    }
    load().catch(() => undefined);
    const timer = window.setInterval(() => load().catch(() => undefined), 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const sources = byId(overview);
  const rowState = (id: string) => closureDetails[id] || stateOf(sources[id]);
  const present = e31Rows.filter(row => sources[row.id]).length;
  const live = e31Rows.filter(row => rowState(row.id) === 'ok').length;
  const deferred = e31Rows.filter(row => stateOf(sources[row.id]) === 'deferred').length;
  const missing = e31Rows.length - present;
  const closureLive = closureRows.filter(id => rowState(id) === 'ok').length;
  const closureMissing = closureRows.length - closureRows.filter(id => sources[id]).length;
  const closureState = closureMissing ? 'unavailable' : closureLive === closureRows.length ? 'ok' : 'degraded';

  return (
    <article className="panel e31-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Epic 31 / Epic 32</p>
          <h2>Native Closure Board</h2>
        </div>
        <StatusChip state={closureState} label={closureState === 'ok' ? 'closed' : closureMissing ? 'catalog gap' : 'closure partial'} />
      </div>

      <div className="e31-headline">
        <button type="button" onClick={() => onOpen('e31_native_spine_status')}>
          <strong>{closureLive}/{closureRows.length}</strong>
          <span>closure probes green</span>
          <small>E31 and E32 closure evidence via Amber Bus</small>
        </button>
        <button type="button" onClick={() => onOpen('e31_modules_status')}>
          <strong>{live}</strong>
          <span>live now</span>
          <small>{present}/{e31Rows.length} Console sources registered</small>
        </button>
        <button type="button" onClick={() => onOpen('memorr_e32_status')}>
          <strong>{deferred}</strong>
          <span>detail deferred</span>
          <small>supporting feeds stay click-through where heavy</small>
        </button>
      </div>

      <div className="e31-source-grid">
        {e31Rows.map(row => {
          const source = sources[row.id];
          return (
            <button type="button" key={row.id} onClick={() => onOpen(row.id)} className="e31-source-card">
              <div>
                <strong>{row.label}</strong>
                <span>{row.expectation}</span>
              </div>
              <StatusChip state={rowState(row.id)} />
              <small>{previewOf(source)}</small>
            </button>
          );
        })}
      </div>
    </article>
  );
}
