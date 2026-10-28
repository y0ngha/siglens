'use client';

import { type OverallAnalysisResponse } from '@y0ngha/siglens-core';
import { useNewsAnalysisTrigger } from '@/entities/news-article/hooks/useNewsAnalysisTrigger';
import { useWaitForNewsCards } from '@/entities/news-article/hooks/useWaitForNewsCards';
import { useAiAutoRunAllowed } from '@/features/symbol-model/hooks/useAiAutoRunAllowed';
import { useAnalysisSettingsHydrated } from '@/features/symbol-model/hooks/useAnalysisSettingsHydrated';
import { useDefaultModelId } from '@/features/symbol-model/hooks/useDefaultModelId';
import { useDefaultReasoning } from '@/features/symbol-model/hooks/useDefaultReasoning';
import { useSymbolModel } from '@/features/symbol-model/model/SymbolModelContext';
import { mapAnalysisStatus } from '@/features/share/lib/mapAnalysisStatus';
import { useRegisterShareable } from '@/features/share/model/ShareableAnalysisContext';
import type { AssetClass } from '@/shared/config/marketProfile/types';
import { PlainAnalysisSwitch } from '@/shared/ui/PlainAnalysisSwitch';
import { useOverallAnalysis } from './hooks/useOverallAnalysis';
import { useTimeframeFromUrl } from './hooks/useTimeframeFromUrl';
import { OverallView } from './OverallView';
import { OverallNoticeBanner } from './ui/notice/OverallNoticeBanner';
import { ReanalyzeButton } from './ui/reanalyze/ReanalyzeButton';
import { OverallErrorCard } from './ui/state-cards/OverallErrorCard';
import { OverallLoadingCard } from './ui/state-cards/OverallLoadingCard';
import { OverallPollErrorCard } from './ui/state-cards/OverallPollErrorCard';
import { OverallTriggerCta } from './ui/trigger-cta/OverallTriggerCta';
import { shouldHighlightReanalyze } from './utils/optionsSection';

interface OverallContentProps {
    symbol: string;
    companyName: string;
    /**
     * 서버에서 peek로 미리 읽은 캐시 종합 분석 서사(SSR seed). 주어지면 마운트 즉시
     * done 상태로 렌더한다(LLM 비용 0). 생성을 허락하지는 않는다.
     */
    initialAnalysis?: OverallAnalysisResponse;
    /**
     * SSR snapshot에서 enriched news card가 1개라도 있는지. `true`면 useWaitForNewsCards가
     * 폴링 없이 즉시 ready로 결정한다. `/news`와 동일 게이트 — 종합 분석 input과
     * /news submitNewsAnalysis 호출의 input이 동기화돼야 axis cache가 공유된다.
     */
    hasEnrichedNews: boolean;
    /** 분석 대상 자산군. 크립토는 옵션·펀더멘털·재무 섹션과 해당 부제 항목이 빠진다. */
    assetClass?: AssetClass;
    /**
     * 옵션 탭이 실제로 존재하는지. `assetClass`만으로는 옵션 탭이 없는 한국 개별주식을
     * 구분하지 못해 페이지가 `getDescriptor(marketProfile).tabs.includes('options')`로
     * 판정해 넘긴다. 옵션 섹션·재분석 강조·CTA 부제가 모두 이 값을 따른다. 기본값이
     * 있으면 호출부가 빼먹어도 조용히 "옵션 있음"으로 흡수되므로 필수로 둔다.
     */
    hasOptions: boolean;
}

/**
 * 종합 분석 탭의 오케스트레이터. 뉴스 카드 보강 게이트·timeframe·모델 설정을 모아
 * `useOverallAnalysis`에 넘기고, 반환된 상태 유니온을 카드 하나로 옮긴다.
 * 분석 생성은 CTA 클릭(`trigger`)이나 재분석 클릭(`reanalyze`)으로만 시작된다.
 */
export function OverallContent({
    symbol,
    companyName,
    initialAnalysis,
    hasEnrichedNews,
    assetClass = 'equity',
    hasOptions,
}: OverallContentProps) {
    // /news와 동일 패턴: 마운트 시 개별 카드 분석 fire-and-forget trigger + cards ready 폴링.
    // 새 뉴스 fetch+분석을 사용자 클릭 전에 시작해두면 trigger 시점엔 분석 완료 row만
    // input으로 들어가 submitNewsAnalysis cache key가 /news와 일치한다(axis hit).
    // 종합 분석 자체는 CTA 클릭으로만 시작하지만, 카드 보강은 마운트에 돈다 — 큐레이션
    // 밖 종목은 첫 신뢰 입력까지 미룬다(`useAiAutoRunAllowed`). CTA 클릭이 곧 입력이라
    // 사용자가 누르는 시점엔 보강이 이미 시작돼 있다.
    const { allowed: autoRunAllowed } = useAiAutoRunAllowed(symbol);
    useNewsAnalysisTrigger(symbol, autoRunAllowed);
    const { isReady: isCardsReady, pollError } = useWaitForNewsCards(
        symbol,
        hasEnrichedNews,
        autoRunAllowed
    );

    // tf는 서버가 아니라 client가 URL에서 읽어 [symbol] ISR(정적 렌더)을 유지한다.
    const { tier, isTierHydrated } = useSymbolModel();
    const timeframe = useTimeframeFromUrl(
        symbol,
        isTierHydrated && tier === 'free',
        isTierHydrated
    );
    const modelId = useDefaultModelId();
    const reasoning = useDefaultReasoning();
    const isSettingsHydrated = useAnalysisSettingsHydrated();
    const { state, trigger, reanalyze } = useOverallAnalysis(
        symbol,
        companyName,
        timeframe,
        modelId,
        initialAnalysis,
        reasoning,
        isSettingsHydrated
    );

    useRegisterShareable({
        kind: 'overall',
        status: mapAnalysisStatus(state.status),
        result: state.status === 'done' ? state.result : null,
        context: {
            symbol,
            displayName: companyName ?? symbol,
            assetClass,
            // OverallAnalysisResponse has no analyzedAt; resolveAsOf falls back to createdAt.
            analyzedAt: undefined,
        },
        // 공유 스냅샷에 쉽게보기 산문을 함께 싣는다 — 링크를 받은 사람은
        // SSE 라우트를 타지 않아 평이화를 다시 만들 수 없다.
        plain: state.status === 'done' ? state.plain : null,
        trigger,
    });

    // 뉴스 카드 준비 실패는 시작 CTA만 막는다. 이미 보이는 분석(seed·done)이나
    // 진행 중인 요청은 그 실패와 무관하므로 가리지 않는다.
    if (state.status === 'idle') {
        if (pollError !== null) return <OverallPollErrorCard />;
        // /news와 동일 게이트 — 새 뉴스 fetch+분석을 백그라운드에서 끝낸 뒤 submit이 일어나야
        // submitNewsAnalysis cache key가 /news와 일치(axis hit)한다.
        return (
            <OverallTriggerCta
                onTrigger={trigger}
                disabled={!isCardsReady}
                assetClass={assetClass}
                hasOptions={hasOptions}
            />
        );
    }

    if (state.status === 'submitting') return <OverallLoadingCard />;

    if (state.status === 'error') {
        return (
            <OverallErrorCard
                message={state.error}
                axis={state.axis}
                onRetry={trigger}
            />
        );
    }

    return (
        <div className="space-y-6">
            <PlainAnalysisSwitch plain={state.plain}>
                <OverallView
                    result={state.result}
                    assetClass={assetClass}
                    hasOptions={hasOptions}
                />
            </PlainAnalysisSwitch>
            {state.notice !== null && (
                <OverallNoticeBanner notice={state.notice} />
            )}
            <ReanalyzeButton
                onClick={reanalyze}
                reanalyzing={state.reanalyzing}
                highlighted={shouldHighlightReanalyze(
                    state.result,
                    assetClass,
                    hasOptions
                )}
            />
        </div>
    );
}
