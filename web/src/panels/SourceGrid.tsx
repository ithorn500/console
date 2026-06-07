import type { ConsoleOverview } from '../types';
import { StatusChip } from '../components/StatusChip';

interface SourceGridProps {
  overview: ConsoleOverview | null;
  onOpen: (target: string) => void;
}

export function SourceGrid({ overview, onOpen }: SourceGridProps) {
  return (
    <article className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Sources</p>
          <h2>Owner Status</h2>
        </div>
      </div>
      <div className="source-grid">
        {(overview?.sources || []).map(source => (
          <div className="source-row" key={source.id} onClick={() => onOpen(source.id)}>
            <div>
              <b>{source.label}</b>
              <span>{source.owner} · {source.url}</span>
            </div>
            <StatusChip state={source.state} />
          </div>
        ))}
      </div>
    </article>
  );
}
