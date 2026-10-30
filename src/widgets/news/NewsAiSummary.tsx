'use client';

/**
 * 종목 뉴스 집계 AI 요약 위젯 — 카드 보강 대기 → 분석 조회 → 상태별 화면(대기·로딩·오류·결과) 선택과 공유 등록을
 * 맡는 오케스트레이터. 화면 조각은 `ui/ai-summary/`에 있다.
 */
import { useTranslations } from 'next-intl';
import { useNewsAnalysis } from './hooks/useNewsAnalysis';
import { useNewsAnalysisTrigger } from '@/entities/news-article/hooks/useNewsAnalysisTrigger';
import { useWaitForNewsCards } from '@/entities/news-article/hooks/useWaitForNewsCards';
import { useDefaultModelId } from '@/features/symbol-model/hooks/useDefaultModelId';
import { useDefaultReasoning } from '@/features/symbol-model/hooks/useDefaultReasoning';
import { useAnalysisSettingsHydrated } from '@/features/symbol-model/hooks/useAnalysisSettingsHydrated';
import { useAiRunPermission } from '@/features/symbol-model/hooks/useAiRunPermission';
import { AiAnalysisAwaitingSection } from '@/shared/ui/AiAnalysisAwaitingSection';
import { useRegisterShareable } from '@/features/share/model/ShareableAnalysisContext';
import { mapAnalysisStatus } from '@/features/share/lib/mapAnalysisStatus';
import { PlainAnalysisSwitch } from '@/shared/ui/PlainAnalysisSwitch';
import { NewsAiSummaryInlineError } from './ui/ai-summary/NewsAiSummaryInlineError';
import { NewsAiSummaryView } from './ui/ai-summary/NewsAiSummaryView';
import { StatusCard } from './ui/ai-summary/StatusCard';

interface NewsAiSummaryProps {
    symbol: string;
    companyName: string;
    /**
     * Whether the SSR snapshot already contained at least one AI-enriched
     * news card. When `false`, the component waits for background enrichment
     * to produce the first enriched card before triggering aggregate analysis.
     */
    hasEnrichedNews: boolean;
    /**
     * SSR 스냅샷 프로즈가 같은 AI 결론을 이미 렌더 중일 때 `true`.
     *
     * UI만 숨기고 마운트는 유지한다 — `useRegisterShareable`이 여기서만 불리므로,
     * 페이지가 위젯을 렌더하지 않으면 헤더의 공유 버튼이 이 탭의 분석 결과를
     * 등록받지 못한다. 숨긴 동안은 캐시만 읽고, 공유 흐름이 요청할 때만 생성한다.
     */
    hideView?: boolean;
}

/** 훅과 폴링 오류 전파는 `hideView`와 무관하게 유지하고 렌더만 건너뛴다. */
export function NewsAiSummary({
    symbol,
    companyName,
    hasEnrichedNews,
    hideView = false,
}: NewsAiSummaryProps) {
    const t = useTranslations('widgets.news');
    const { allowed: autoRunAllowed, start } = useAiRunPermission(
        symbol,
        hideView
    );
    useNewsAnalysisTrigger(symbol, autoRunAllowed);

    const { isReady: isCardsReady, pollError } = useWaitForNewsCards(
        symbol,
        hasEnrichedNews,
        autoRunAllowed
    );
    const modelId = useDefaultModelId();
    const reasoning = useDefaultReasoning();
    const isSettingsHydrated = useAnalysisSettingsHydrated();
    // enabled 게이트: enriched news cards가 DB에 적어도 1개 있을 때까지 submit을
    // 미룬다. 이 게이트가 없으면 빈 DB에 대해 submit이 즉시 fire되어 core가
    // no_news 결과를 돌려주고, retry:false + staleTime:Infinity 정책에 의해
    // 에러가 영구 캐시돼 cards가 enrich된 뒤에도 분석 패널이 회복되지 않는다.
    const analysis = useNewsAnalysis(symbol, companyName, modelId, {
        enabled: isCardsReady,
        reasoning,
        isSettingsHydrated,
        autoRunAllowed,
    });

    // 보강된 카드가 아직 없으면 분석 쿼리는 비활성이라 'loading'을 돌려준다. 이를 'pending'으로
    // 매핑하면 분석이 시작되기도 전에 공유 시스템이 "준비 중"을 띄우므로 'idle'로 등록해 실제
    // 분석이 시작될 때까지 공유 버튼을 잠재운다.
    useRegisterShareable({
        kind: 'news',
        status: isCardsReady ? mapAnalysisStatus(analysis.status) : 'idle',
        result: analysis.status === 'done' ? analysis.result : null,
        context: {
            symbol,
            displayName: companyName,
            // NewsAnalysisResponse has no analyzedAt; resolveAsOf falls back to createdAt.
            analyzedAt: undefined,
        },
        // 공유 스냅샷에 쉽게보기 산문을 함께 싣는다 — 링크를 받은 사람은
        // SSE 라우트를 타지 않아 평이화를 다시 만들 수 없다.
        plain: analysis.status === 'done' ? analysis.plain : null,
        // 대기 중에는 캐시 전용 재조회(`analysis.trigger`)가 아니라 실행 권한을 여는 `start`를 건다 —
        // 그래야 헤더 공유 흐름이 분석을 실제로 시작할 수 있다.
        trigger:
            analysis.status === 'awaiting_interaction'
                ? start
                : analysis.trigger,
    });

    // 영구 폴링 오류는 에러 바운더리(NewsAiSummaryErrorBoundary)의 폴백이 맡게 던진다.
    if (pollError !== null) {
        throw pollError;
    }

    if (hideView) return null;

    // 게이트가 닫혀 있으면 카드 보강 자체가 미뤄져 있다 — "수집 중" 스피너를 띄우면
    // 끝나지 않는 로딩처럼 보인다. 분석 미스 대기와 같은 화면을 쓴다.
    if (
        analysis.status === 'awaiting_interaction' ||
        (!isCardsReady && !autoRunAllowed)
    ) {
        return (
            <AiAnalysisAwaitingSection
                heading={t('NewsAiSummary.a74178')}
                idPrefix="news-ai-summary"
                onStart={start}
                className="w-full max-w-full min-w-0"
            />
        );
    }

    if (!isCardsReady) {
        return <StatusCard phase="fetching" />;
    }

    if (analysis.status === 'error') {
        return (
            <NewsAiSummaryInlineError
                error={analysis.error}
                onRetry={analysis.retry}
            />
        );
    }

    if (analysis.status === 'loading') {
        return <StatusCard phase="analyzing" />;
    }

    return (
        <PlainAnalysisSwitch plain={analysis.plain}>
            <NewsAiSummaryView result={analysis.result} />
        </PlainAnalysisSwitch>
    );
}
