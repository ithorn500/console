import type { ConsoleOverview, ConsoleSource } from '../types';

const heroItems = [
  ['amber_bus_overview', 'Spine', 'owner-backed sources'],
  ['concierge_email', 'Ingress', 'Concierge email'],
  ['memorr_email_timeline', 'Memory', 'provenance descriptors'],
  ['veliai_queue', 'Inference', 'Veliai queue'],
  ['guardian_c2_snapshot', 'Apply', 'Guardian C2'],
  ['guardian_lawn_outline', 'Lawn', 'camera boundary']
] as const;

interface HeroGridProps {
  overview: ConsoleOverview | null;
  onOpen: (target: string) => void;
}

function byId(sources: ConsoleSource[], id: string) {
  return sources.find(source => source.id === id);
}

export function HeroGrid({ overview, onOpen }: HeroGridProps) {
  const sources = overview?.sources || [];
  return (
    <section className="hero-grid">
      {heroItems.map(([id, kicker, label]) => (
        <article className="hero-panel" key={id} onClick={() => onOpen(id)}>
          <span className="panel-kicker">{kicker}</span>
          <strong>{id === 'amber_bus_overview' ? sources.length || '--' : byId(sources, id)?.state || '--'}</strong>
          <span>{label}</span>
        </article>
      ))}
    </section>
  );
}
