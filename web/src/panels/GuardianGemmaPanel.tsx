import type { ConsoleOverview, ConsoleSource } from '../types';
import { StatusChip } from '../components/StatusChip';

const ids = ['guardian_c2_snapshot', 'gemma_ops_state', 'gemma_lanes', 'gemma_hardware'];

interface GuardianGemmaPanelProps {
  overview: ConsoleOverview | null;
  onOpen: (target: string) => void;
}

function sourceById(sources: ConsoleSource[], id: string): ConsoleSource | undefined {
  return sources.find(source => source.id === id);
}

export function GuardianGemmaPanel({ overview, onOpen }: GuardianGemmaPanelProps) {
  const sources = overview?.sources || [];
  return (
    <article className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Guardian + Gemma</p>
          <h2>Strategy, Apply, Hardware</h2>
        </div>
        <span className="hint">owner-native panels mirrored</span>
      </div>
      <div className="best-grid">
        {ids.map(id => {
          const source = sourceById(sources, id);
          return (
            <div className="best-card" key={id} onClick={() => onOpen(id)}>
              <StatusChip state={source?.state || 'unavailable'} />
              <h3>{source?.label || id}</h3>
              <p>{source?.preview || 'No owner evidence returned yet.'}</p>
            </div>
          );
        })}
      </div>
    </article>
  );
}
