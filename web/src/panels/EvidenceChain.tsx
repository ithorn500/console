import type { EvidenceChain as EvidenceChainData } from '../types';
import { StatusChip } from '../components/StatusChip';

interface EvidenceChainProps {
  chain: EvidenceChainData | null;
  onOpen: (target: string) => void;
}

export function EvidenceChain({ chain, onOpen }: EvidenceChainProps) {
  return (
    <article className="panel wide">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Evidence Chain</p>
          <h2>Concierge -&gt; Memorr -&gt; OCR -&gt; Veliai -&gt; Proof</h2>
        </div>
        <span className="hint">click any node</span>
      </div>
      <div className="chain-graph">
        {(chain?.nodes || []).map(node => (
          <div className="chain-node" key={node.id} onClick={() => onOpen(node.id)}>
            <StatusChip state={node.state} />
            <h2>{node.label}</h2>
            <p className="panel-kicker">{node.owner} · {node.duration_ms}ms</p>
            <div className="preview">{node.preview}</div>
          </div>
        ))}
      </div>
    </article>
  );
}
