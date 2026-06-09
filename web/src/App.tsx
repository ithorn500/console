import { useCallback, useEffect, useState } from 'react';
import '@xyflow/react/dist/style.css';
import { fetchEvidenceChain, fetchOverview, fetchSource } from './api/consoleApi';
import { EvidenceDrawer } from './components/EvidenceDrawer';
import { ActorrMediaPipelinePanel } from './panels/ActorrMediaPipelinePanel';
import { ActorrOpsPanel } from './panels/ActorrOpsPanel';
import { AdGuardPerimeterPanel } from './panels/AdGuardPerimeterPanel';
import { AmberBusSpinePanel } from './panels/AmberBusSpinePanel';
import { AmberLiveMap } from './panels/AmberLiveMap';
import { AmberTopology } from './panels/AmberTopology';
import { ConciergeBackupPanel } from './panels/ConciergeBackupPanel';
import { ConsoleStreamProofPanel } from './panels/ConsoleStreamProofPanel';
import { EvidenceChain } from './panels/EvidenceChain';
import { E31NativeSpinePanel } from './panels/E31NativeSpinePanel';
import { GemmaOpsMirrorPanel } from './panels/GemmaOpsMirrorPanel';
import { GuardianC2DrilldownPanel } from './panels/GuardianC2DrilldownPanel';
import { GuardianC2SnapshotPanel } from './panels/GuardianC2SnapshotPanel';
import { GuardianGemmaPanel } from './panels/GuardianGemmaPanel';
import { GuardianLawnPanel } from './panels/GuardianLawnPanel';
import { GuardianStrategyPanel } from './panels/GuardianStrategyPanel';
import { HeroGrid } from './panels/HeroGrid';
import { HomeAssistantEvidencePanel } from './panels/HomeAssistantEvidencePanel';
import { LoggerEvidencePanel } from './panels/LoggerEvidencePanel';
import { MemoryConciergeLoop } from './panels/MemoryConciergeLoop';
import { MemorrLifeFlow } from './panels/MemorrLifeFlow';
import { NeuFabFabricPanel } from './panels/NeuFabFabricPanel';
import { OwnerActionReadinessPanel } from './panels/OwnerActionReadinessPanel';
import { OwnerPanelParityPanel } from './panels/OwnerPanelParityPanel';
import { OwnerRetirementReadinessPanel } from './panels/OwnerRetirementReadinessPanel';
import { PromotionReadinessPanel } from './panels/PromotionReadinessPanel';
import { SourceGrid } from './panels/SourceGrid';
import { SourceReliabilityPanel } from './panels/SourceReliabilityPanel';
import { SurfaceDirectory } from './panels/SurfaceDirectory';
import { VeliaiRouterMap } from './panels/VeliaiRouterMap';
import type { ConsoleOverview, EvidenceChain as EvidenceChainData, SourceDetail } from './types';

export function App() {
  const [view, setView] = useState(() => window.location.hash === '#backup' ? 'backup' : 'home');
  const [refreshState, setRefreshState] = useState('loading');
  const [overview, setOverview] = useState<ConsoleOverview | null>(null);
  const [chain, setChain] = useState<EvidenceChainData | null>(null);
  const [detail, setDetail] = useState<SourceDetail | null>(null);
  const [loadingTarget, setLoadingTarget] = useState<string | null>(null);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [overviewResult, chainResult] = await Promise.allSettled([
      fetchOverview(),
      fetchEvidenceChain()
    ]);
    const errors: string[] = [];
    if (overviewResult.status === 'fulfilled') {
      setOverview(overviewResult.value);
    } else {
      errors.push(overviewResult.reason instanceof Error ? overviewResult.reason.message : String(overviewResult.reason));
    }
    if (chainResult.status === 'fulfilled') {
      setChain(chainResult.value);
    } else {
      errors.push(chainResult.reason instanceof Error ? chainResult.reason.message : String(chainResult.reason));
    }
    setRefreshState(errors.length ? `partial ${new Date().toLocaleTimeString()}` : `updated ${new Date().toLocaleTimeString()}`);
  }, []);

  const openDetail = useCallback(async (target: string) => {
    setDetail(null);
    setDrawerError(null);
    setLoadingTarget(target);
    try {
      const source = await fetchSource(target, { loggerEvidence: true });
      setDetail(source);
    } catch (err) {
      setDrawerError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingTarget(null);
    }
  }, []);

  useEffect(() => {
    refresh().catch(err => setRefreshState(err instanceof Error ? err.message : String(err)));
    const timer = window.setInterval(() => {
      refresh().catch(() => undefined);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const onHashChange = () => setView(window.location.hash === '#backup' ? 'backup' : 'home');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <>
      <main className="shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Amber Console</p>
            <h1>Amber Console</h1>
          </div>
          <div className="statusbar">
            <span>{refreshState}</span>
            <a className="topbar-link" href="#backup">Backup</a>
            <a className="topbar-link" href="/architecture/#diagrams">Architecture</a>
            <button type="button" onClick={() => refresh().catch(err => setRefreshState(String(err)))}>Refresh</button>
          </div>
        </header>

        <section className="data-plane-strip">
          <b>Amber Bus only</b>
          <span>Web and Windows consume the same owner contracts. Local service proximity is ignored.</span>
          <span>{overview?.summary.ok ?? '--'} live / {overview?.summary.degraded_or_unavailable ?? '--'} degraded</span>
        </section>

        {view === 'backup' ? (
          <section className="backup-dedicated-workspace">
            <ConciergeBackupPanel onOpen={openDetail} />
          </section>
        ) : (
          <>
            <SurfaceDirectory />

            <HeroGrid overview={overview} onOpen={openDetail} />

            <section className="ops-workspace">
              <AmberLiveMap onOpen={openDetail} />
              <AmberBusSpinePanel onOpen={openDetail} />
              <div className="workspace">
                <AmberTopology overview={overview} onOpen={openDetail} />
                <GuardianGemmaPanel overview={overview} onOpen={openDetail} />
              </div>
              <OwnerPanelParityPanel onOpen={openDetail} />
              <OwnerActionReadinessPanel onOpen={openDetail} />
              <OwnerRetirementReadinessPanel overview={overview} onOpen={openDetail} />
              <PromotionReadinessPanel overview={overview} onOpen={openDetail} />
              <E31NativeSpinePanel overview={overview} onOpen={openDetail} />
              <GuardianC2SnapshotPanel onOpen={openDetail} />
              <GuardianC2DrilldownPanel onOpen={openDetail} />
              <GuardianStrategyPanel onOpen={openDetail} />
              <HomeAssistantEvidencePanel onOpen={openDetail} />
              <AdGuardPerimeterPanel onOpen={openDetail} />
              <GemmaOpsMirrorPanel onOpen={openDetail} />
              <GuardianLawnPanel onOpen={openDetail} />
              <ActorrOpsPanel onOpen={openDetail} />
              <ActorrMediaPipelinePanel onOpen={openDetail} />
              <LoggerEvidencePanel onOpen={openDetail} />
              <ConciergeBackupPanel onOpen={openDetail} />
              <MemoryConciergeLoop />
              <NeuFabFabricPanel onOpen={openDetail} />
              <VeliaiRouterMap onOpen={openDetail} />
              <MemorrLifeFlow onOpen={openDetail} />
              <EvidenceChain chain={chain} onOpen={openDetail} />
              <SourceReliabilityPanel overview={overview} onOpen={openDetail} />
              <ConsoleStreamProofPanel />
              <SourceGrid overview={overview} onOpen={openDetail} />
            </section>
          </>
        )}
      </main>

      <EvidenceDrawer
        detail={detail}
        loadingTarget={loadingTarget}
        error={drawerError}
        onClose={() => {
          setDetail(null);
          setDrawerError(null);
          setLoadingTarget(null);
        }}
      />
    </>
  );
}
