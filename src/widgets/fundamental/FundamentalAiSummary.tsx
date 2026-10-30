'use client';

/**
 * 펀더멘털 AI 요약 오케스트레이터 — 분석 훅·실행 권한·공유 등록을 잇고 상태별 화면만 고른다.
 * 결과 본문 렌더는 `ui/ai-summary/FundamentalAiSummaryView`가 맡는다.
 */
import { useTranslations } from 'next-intl';
import { useRegisterShareable } from '@/features/share/model/ShareableAnalysisContext';
import { mapAnalysisStatus } from '@/features/share/lib/mapAnalysisStatus';
import { useDefaultModelId } from '@/features/symbol-model/hooks/useDefaultModelId';
import { useDefaultReasoning } from '@/features/symbol-model/hooks/useDefaultReasoning';
import { useAnalysisSettingsHydrated } from '@/features/symbol-model/hooks/useAnalysisSettingsHydrated';
import { useAiRunPermission } from '@/features/symbol-model/hooks/useAiRunPermission';
import { AiAnalysisAwaitingSection } from '@/shared/ui/AiAnalysisAwaitingSection';
import { PlainAnalysisSwitch } from '@/shared/ui/PlainAnalysisSwitch';
import { useFundamentalAnalysis } from './hooks/useFundamentalAnalysis';
import { FundamentalAiSummaryError } from './FundamentalAiSummaryError';
import { FundamentalAiSummarySkeleton } from './FundamentalAiSummarySkeleton';
import { FundamentalAiSummaryView } from './ui/ai-summary/FundamentalAiSummaryView';

interface FundamentalAiSummaryProps {
    symbol: string;
    /**
     * SSR 스냅샷 프로즈가 같은 AI 결론을 이미 렌더 중일 때 `true`.
     *
     * 이 경우 위젯은 **UI만 숨기고 마운트는 유지**한다 — `useRegisterShareable`이
     * 여기서만 불리므로, 페이지가 위젯을 아예 렌더하지 않으면 헤더의 공유
     * 버튼이 이 탭의 분석 결과를 등록받지 못한다. 중복 텍스트를 없애려던
     * 원래 의도는 렌더만 건너뛰면 충족되므로, 훅은 그대로 돌려 공유 데이터를
     * 계속 등록한다.
     */
    hideView?: boolean;
}

/** 펀더멘털 탭의 AI 요약. `hideView`여도 마운트는 유지해 공유 버튼에 결과를 등록한다. */
export function FundamentalAiSummary({
    symbol,
    hideView = false,
}: FundamentalAiSummaryProps) {
    const t = useTranslations('widgets.fundamental');
    const modelId = useDefaultModelId();
    const reasoning = useDefaultReasoning();
    const isSettingsHydrated = useAnalysisSettingsHydrated();
    const { allowed, start } = useAiRunPermission(symbol, hideView);
    const state = useFundamentalAnalysis(
        symbol,
        modelId,
        reasoning,
        isSettingsHydrated,
        allowed
    );

    useRegisterShareable({
        kind: 'fundamental',
        status: mapAnalysisStatus(state.status),
        result: state.status === 'done' ? state.result : null,
        context: {
            symbol,
            displayName: symbol,
            // FundamentalAnalysisResponse has no analyzedAt; resolveAsOf falls back to createdAt.
            analyzedAt: undefined,
        },
        // 공유 스냅샷에 쉽게보기 산문을 함께 싣는다 — 링크를 받은 사람은
        // SSE 라우트를 타지 않아 평이화를 다시 만들 수 없다.
        plain: state.status === 'done' ? state.plain : null,
        // 대기 중에는 캐시 전용 재조회(`state.trigger`)가 아니라 생성을 여는 `start`여야
        // 헤더 공유 흐름이 분석을 시작할 수 있다.
        trigger:
            state.status === 'awaiting_interaction' ? start : state.trigger,
    });

    // 훅은 모두 실행된 뒤에 렌더만 건너뛴다 — 공유 데이터 등록은 유지된다.
    if (hideView) return null;

    if (state.status === 'loading') {
        return <FundamentalAiSummarySkeleton />;
    }

    if (state.status === 'awaiting_interaction') {
        return (
            <AiAnalysisAwaitingSection
                heading={t('FundamentalAiSummary.17769c')}
                idPrefix="ai-summary"
                onStart={start}
            />
        );
    }

    if (state.status === 'error') {
        return (
            <FundamentalAiSummaryError
                error={state.error}
                resetErrorBoundary={state.retry}
            />
        );
    }

    return (
        <PlainAnalysisSwitch plain={state.plain}>
            <FundamentalAiSummaryView result={state.result} />
        </PlainAnalysisSwitch>
    );
}
