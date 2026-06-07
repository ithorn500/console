import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';

type SurfaceStatus = 'live' | 'source' | 'product' | 'offline';

type Surface = {
  owner: string;
  title: string;
  url: string;
  snapshot?: string;
  status: SurfaceStatus;
  tech: string;
  route: string;
  source: string;
  description: string;
};

const surfaces: Surface[] = [
  {
    owner: 'AIGateway',
    title: 'Veliai Client',
    url: 'http://gemma.amber.com:11434/',
    snapshot: 'veliai-client.png',
    status: 'live',
    tech: 'SvelteKit static bundle',
    route: ':11434',
    source: 'app/veliai-client',
    description: 'Public AI web/API front door with OpenAI-compatible chat, model selection, MCP/settings, and Veliai-routed conversations.'
  },
  {
    owner: 'AIGateway',
    title: 'Gateway Ops Portal',
    url: 'http://gemma.amber.com:11430/ui/ops',
    snapshot: 'gateway-ops.png',
    status: 'live',
    tech: 'Static HTML + C++ edge',
    route: ':11430/ui/ops',
    source: 'app/bundled/ops_ui.html',
    description: 'Gateway operator deck for model lanes, worker state, provider health, queue pressure, docs links, and guarded ops actions.'
  },
  {
    owner: 'AIGateway',
    title: 'Veliai Media Native Panel',
    url: 'http://gemma.amber.com:11430/ui/media',
    snapshot: 'veliai-media-native.png',
    status: 'live',
    tech: 'C++ embedded HTML',
    route: ':11430/ui/media',
    source: 'native/veliai_media + gg-beast-edge',
    description: 'Media/NVR/perception command surface for cameras, review evidence, identity, zones, occupancy, retention, and learning queues.'
  },
  {
    owner: 'AIGateway',
    title: 'Veliai Media React Preview',
    url: 'http://gemma.amber.com:11430/ui/media/react/',
    snapshot: 'veliai-media-react.png',
    status: 'live',
    tech: 'React + Vite',
    route: ':11430/ui/media/react',
    source: 'ui/veliai-media',
    description: 'React operator preview for Veliai Media command, live, review, replay, library, and identity workflows.'
  },
  {
    owner: 'AIGateway',
    title: 'llama.cpp Web UI',
    url: 'http://gemma.amber.com:11438/ui/llama',
    snapshot: 'llama-webui.png',
    status: 'live',
    tech: 'Browser SPA',
    route: ':11438/ui/llama',
    source: 'app/bundled/llama_cpp_webui',
    description: 'Browser-delivered llama.cpp interaction shell for direct/fallback chat and model debugging. It is UI, not native runtime code.'
  },
  {
    owner: 'AIGateway',
    title: 'Memory Chat',
    url: 'http://gemma.amber.com:11438/ui/memory',
    snapshot: 'memory-chat.png',
    status: 'live',
    tech: 'Static HTML',
    route: ':11438/ui/memory',
    source: 'app/bundled/memory_chat',
    description: 'Memory and knowledge workbench for recall, intake, diagnostics, and local chat probes against Gateway-owned memory/model APIs.'
  },
  {
    owner: 'AIGateway',
    title: 'Veliai Model Surface',
    url: 'http://gemma.amber.com:11438/ui/veliai/',
    snapshot: 'veliai-model-surface.png',
    status: 'live',
    tech: 'Static HTML',
    route: ':11438/ui/veliai',
    source: 'app/bundled/veliai_model_surface',
    description: 'Model/provider selection and IDE route-plan surface for provider status, route previews, and Bus-shaped model choices.'
  },
  {
    owner: 'AIGateway',
    title: 'Voice Satellite',
    url: 'http://gemma.amber.com:11438/ui/voice-satellite',
    snapshot: 'voice-satellite.png',
    status: 'live',
    tech: 'Static HTML',
    route: ':11438/ui/voice-satellite',
    source: 'app/bundled/voice_satellite',
    description: 'Browser fallback/debug surface for microphone registration, bounded audio windows, wake/STT evidence, and queued reply playback.'
  },
  {
    owner: 'AIGateway',
    title: 'Ollama Cloud UI Edge',
    url: 'http://gemma.amber.com:11437/ui/ollama',
    snapshot: 'ollama-cloud.png',
    status: 'live',
    tech: 'C++ edge + optional UI',
    route: ':11437/ui/ollama',
    source: 'native/gg_beast_edge/ollama_cloud_engine.hpp',
    description: 'Cloud-only Ollama provider surface with health, model metadata, OpenAI/Ollama-compatible APIs, and UI compatibility stubs.'
  },
  {
    owner: 'AIGateway',
    title: 'RAG Orchestration Dashboard',
    url: 'http://gemma.amber.com:11430/ui/ops',
    status: 'source',
    tech: 'React + Vite + Tailwind',
    route: 'source only',
    source: 'web/rag-orchestration-dashboard',
    description: 'Development/operator visualization for RAG substrate, preflight, routing, execution, and Beast edge migration progress.'
  },
  {
    owner: 'Guardian',
    title: 'Guardian C2 Deck',
    url: 'http://guardian.amber.com/app/guardian_c2_deck_page',
    snapshot: 'guardian-c2.png',
    status: 'live',
    tech: 'Static HTML + aiohttp',
    route: 'guardian.amber.com/app/guardian_c2_deck_page',
    source: '/mnt/guardian/src/www/guardian_c2_deck_v3.html',
    description: 'Main home-control command deck for policy state, device management, HA telemetry, apps, evidence, logs, and safe actions.'
  },
  {
    owner: 'Guardian',
    title: 'Guardian Wallpanel',
    url: 'http://guardian.amber.com/app/guardian_wallpanel_page',
    snapshot: 'guardian-wallpanel.png',
    status: 'live',
    tech: 'Static HTML + aiohttp',
    route: 'guardian.amber.com/app/guardian_wallpanel_page',
    source: '/mnt/guardian/src/www/guardian_wallpanel.html',
    description: 'Wallpanel/kiosk view for Guardian state, device-management visibility, house status, and tablet-facing operator surfaces.'
  },
  {
    owner: 'Guardian',
    title: 'Guardian Auth Landing',
    url: 'http://guardian.amber.com/app/guardian_c2_auth_page',
    snapshot: 'guardian-auth.png',
    status: 'live',
    tech: 'Static HTML + aiohttp',
    route: 'guardian.amber.com/app/guardian_c2_auth_page',
    source: '/mnt/guardian/src/www/guardian_c2_auth_landing.html',
    description: 'Operator authentication landing and gate for Guardian C2 access.'
  },
  {
    owner: 'Guardian',
    title: 'Guardian Tablet Installer',
    url: 'http://guardian.amber.com/install',
    snapshot: 'guardian-tablet-install.png',
    status: 'live',
    tech: 'Static artifact page',
    route: 'guardian.amber.com/install',
    source: '/mnt/guardian/src/www/guardian-tablet',
    description: 'First-time Android Guardian tablet install and update artifact page backed by the stable manifest and latest release APK.'
  },
  {
    owner: 'Guardian',
    title: 'Guardian HA Dashboard Replica',
    url: 'http://guardian.amber.com/app/guardian_c2_deck_page',
    status: 'source',
    tech: 'React + Vite',
    route: 'source only',
    source: '/mnt/guardian/ha-dashboard-replica',
    description: 'Experimental HA-like dashboard replica that uses Guardian frontend WebSocket paths when run from its owner environment.'
  },
  {
    owner: 'Amber Bus',
    title: 'Bus Command Centre',
    url: 'http://amber-bus.amber.com:8080/ui',
    status: 'offline',
    tech: 'Static HTML + native C++ edge',
    route: ':8080/ui',
    source: '/mnt/amber-bus/web/index.html',
    description: 'Bus topology, route, traffic, panel, audit, registration, and live ops map surface. Current read-only probe returned 404.'
  },
  {
    owner: 'Amber Bus',
    title: 'Bus Management Shell',
    url: 'http://amber-bus.amber.com:8080/static/management.html',
    status: 'offline',
    tech: 'Static HTML + JS',
    route: ':8080/static/management.html',
    source: '/mnt/amber-bus/web/management.html',
    description: 'Management UI for apps, route health, traffic, panels, drilldowns, and registration. Source is present; route probe returned 404.'
  },
  {
    owner: 'Amber Bus',
    title: 'Concierge Surface',
    url: 'http://amber-bus.amber.com:8080/static/concierge.html',
    status: 'offline',
    tech: 'Static HTML + JS',
    route: ':8080/static/concierge.html',
    source: '/mnt/amber-bus/web/concierge.html',
    description: 'Concierge panel for email, VPN posture, iCloud photo sync, LSB, Life, and Memorr route evidence through Bus-owned summaries.'
  },
  {
    owner: 'Logger',
    title: 'Logger Ops Dashboard',
    url: 'http://logger.amber.com:8055/',
    snapshot: 'logger-dashboard.png',
    status: 'live',
    tech: 'Native C++ service + static UI',
    route: 'logger.amber.com:8055',
    source: '/mnt/logger/app/templates/index.html',
    description: 'Observability dashboard for incidents, analytics, collector state, saved views, stream evidence, and command-centre summaries.'
  },
  {
    owner: 'Actorr',
    title: 'Actorr Portal',
    url: 'http://actorr.amber.com/',
    snapshot: 'actorr-portal.png',
    status: 'live',
    tech: 'Starlette + static JS',
    route: 'actorr.amber.com:80',
    source: '/mnt/actorr/actorr/portal/http_portal.py',
    description: 'Main media actuator portal for providers, relay/live mapping, diagnostics, settings, credentials, backup, and client controls.'
  },
  {
    owner: 'Actorr',
    title: 'Actorr Operator Panel',
    url: 'http://actorr.amber.com:8081/',
    snapshot: 'actorr-operator.png',
    status: 'live',
    tech: 'Starlette operator UI',
    route: 'actorr.amber.com:8081',
    source: '/mnt/actorr/actorr/portal/operator_panel.py',
    description: 'Standalone operator visualization that pulls portal/Velox state and routes actions through Actorr Bus functions.'
  },
  {
    owner: 'Actorr',
    title: 'Velox Dashboard',
    url: 'http://actorr.amber.com:8082/',
    snapshot: 'velox-dashboard.png',
    status: 'live',
    tech: 'React + Vite hosted by Starlette',
    route: 'actorr.amber.com:8082',
    source: '/mnt/actorr/examples/velox-dashboard',
    description: 'Graphics-heavy Velox operator dashboard for native media pipeline state, work routing, provider health, and route control.'
  },
  {
    owner: 'AdGuardHome',
    title: 'AdGuardHome Console',
    url: 'http://adguard.amber.com/',
    snapshot: 'adguard.png',
    status: 'product',
    tech: 'Go + React product UI',
    route: 'adguard.amber.com:80',
    source: '/mnt/adguard',
    description: 'Product-native DNS/filtering admin console. Amber should integrate through connector summaries, not direct browser scraping.'
  },
  {
    owner: 'pfSense',
    title: 'pfSense WebConfigurator',
    url: 'http://pfsense.amber.com/',
    status: 'product',
    tech: 'PHP product UI',
    route: 'runtime configured',
    source: '/mnt/pfsense/src/usr/local/www',
    description: 'Product-native firewall/router GUI for status, diagnostics, rules, NAT, VPN, interfaces, and captive portal configuration.'
  },
  {
    owner: 'Home Assistant',
    title: 'Home Assistant',
    url: 'http://homeassistant.amber.com:8123/',
    snapshot: 'homeassistant.png',
    status: 'product',
    tech: 'Home Assistant frontend',
    route: 'homeassistant.amber.com:8123',
    source: '/mnt/homeassistant',
    description: 'Live house telemetry and Lovelace UI. It remains the device/entity fabric Guardian consumes, not the Guardian policy runtime.'
  },
  {
    owner: 'Memorr',
    title: 'Memorr Life Screen',
    url: 'http://memorr.amber.com/',
    status: 'source',
    tech: 'React + Three.js + Vite',
    route: 'source only',
    source: '/mnt/memorr/opt/memorr/ui/life-screen',
    description: 'Source-present 3D Life/management screen for the Memorr memory/storage boundary. Live public route was not found in this pass.'
  },
  {
    owner: 'MediaDownloader',
    title: 'Mediarr Arr UI',
    url: 'http://mediadownloader.amber.com/',
    snapshot: 'mediarr.png',
    status: 'live',
    tech: '.NET Arr shell',
    route: 'mediadownloader.amber.com:80',
    source: '/mnt/mediadownloader/mediarr/sonarr-base',
    description: 'Productized Arr-style unified TV/movie operator UI, branded as Mediarr and extended with movie sections and integration state.'
  },
  {
    owner: 'MediaDownloader',
    title: 'Mediarr Transitional Control',
    url: 'http://mediadownloader.amber.com:15083/',
    status: 'source',
    tech: '.NET static ops shell',
    route: ':15083',
    source: '/mnt/mediadownloader/mediarr/src/Mediarr.Api/wwwroot',
    description: 'Legacy transitional setup/control shell for bounded merge work. Docs say it remains available while the Arr runtime owns port 80.'
  },
  {
    owner: 'MediaDownloader',
    title: 'Sonarr Source Fork',
    url: 'http://mediadownloader.amber.com:8989/',
    status: 'source',
    tech: 'Sonarr frontend source',
    route: ':8989 default',
    source: '/mnt/mediadownloader/sonarr',
    description: 'Mounted Sonarr source fork and compatibility reference. Live default port was not reachable from this host during read-only probing.'
  },
  {
    owner: 'MediaDownloader',
    title: 'Radarr Source Fork',
    url: 'http://mediadownloader.amber.com:7878/',
    status: 'source',
    tech: 'Radarr frontend source',
    route: ':7878 default',
    source: '/mnt/mediadownloader/radarr',
    description: 'Mounted Radarr source fork and compatibility reference for movie-domain behavior. Live default port was not reachable in this pass.'
  },
  {
    owner: 'MediaDownloader',
    title: 'SABnzbd Source Fork',
    url: 'http://mediadownloader.amber.com:8080/',
    status: 'source',
    tech: 'SABnzbd web UI source',
    route: ':8080 default',
    source: '/mnt/mediadownloader/sabnzbd',
    description: 'Mounted SABnzbd source fork and download-client reference. No live restart or client operation was attempted.'
  }
];

const ownerColors: Record<string, string> = {
  AIGateway: '#22e7ff',
  Guardian: '#35ff7f',
  'Amber Bus': '#c477ff',
  Logger: '#ffd238',
  Actorr: '#3aa6ff',
  AdGuardHome: '#35ff7f',
  pfSense: '#ff5b87',
  'Home Assistant': '#9db0c8',
  Memorr: '#c477ff',
  MediaDownloader: '#3aa6ff'
};

const statusLabels: Record<SurfaceStatus, string> = {
  live: 'Live',
  source: 'Source',
  product: 'Product',
  offline: 'Route gap'
};

function matches(surface: Surface, owner: string, query: string) {
  if (owner !== 'All' && surface.owner !== owner) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [surface.owner, surface.title, surface.route, surface.tech, surface.source, surface.description]
    .join(' ')
    .toLowerCase()
    .includes(q);
}

export function SurfaceDirectory() {
  const [owner, setOwner] = useState('All');
  const [query, setQuery] = useState('');
  const owners = useMemo(() => ['All', ...Array.from(new Set(surfaces.map(surface => surface.owner)))], []);
  const filtered = useMemo(() => surfaces.filter(surface => matches(surface, owner, query)), [owner, query]);
  const liveCount = surfaces.filter(surface => surface.status === 'live').length;
  const snapshotCount = surfaces.filter(surface => surface.snapshot).length;

  return (
    <section className="surface-directory" aria-label="Amber web surface directory">
      <div className="surface-directory-head">
        <div>
          <p className="eyebrow">Console Home</p>
          <h2>All Web Surfaces</h2>
          <p>
            A graphical index of browser surfaces found across the mounted Amber repos. Cards link out to owners;
            Console remains display-only and does not use these owner URLs as its data plane.
          </p>
        </div>
        <div className="surface-directory-stats" aria-label="Surface directory totals">
          <span><b>{surfaces.length}</b> surfaces</span>
          <span><b>{owners.length - 1}</b> owners</span>
          <span><b>{liveCount}</b> live links</span>
          <span><b>{snapshotCount}</b> snapshots</span>
        </div>
      </div>

      <div className="surface-directory-controls">
        <label>
          <span>Search</span>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            type="search"
            placeholder="owner, route, description"
          />
        </label>
        <div className="surface-owner-filter">
          {owners.map(item => (
            <button
              key={item}
              type="button"
              className={owner === item ? 'active' : ''}
              onClick={() => setOwner(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="surface-card-grid">
        {filtered.map(surface => {
          const color = ownerColors[surface.owner] ?? '#9db0c8';
          return (
            <article className="surface-card" key={`${surface.owner}-${surface.title}`} style={{ '--surface-color': color } as CSSProperties}>
              <a className="surface-shot" href={surface.url}>
                {surface.snapshot ? (
                  <img src={`/surface-home/snapshots/${surface.snapshot}`} alt={`${surface.title} screenshot`} loading="lazy" />
                ) : (
                  <span className="surface-placeholder">{statusLabels[surface.status]}</span>
                )}
              </a>
              <div className="surface-card-body">
                <div className="surface-card-title-row">
                  <div>
                    <span className="surface-owner">{surface.owner}</span>
                    <h3>{surface.title}</h3>
                  </div>
                  <span className={`surface-status ${surface.status}`}>{statusLabels[surface.status]}</span>
                </div>
                <p>{surface.description}</p>
                <div className="surface-meta">
                  <span>{surface.route}</span>
                  <span>{surface.tech}</span>
                </div>
                <div className="surface-actions">
                  <a href={surface.url}>Open</a>
                </div>
                <small>{surface.source}</small>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
