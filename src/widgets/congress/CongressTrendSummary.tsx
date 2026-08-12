'use client';

import { useMemo } from 'react';
import {
    useDefaultModelId,
    useDefaultReasoning,
    useAnalysisSettingsHydrated,
} from '@/features/symbol-model';
import { useRegisterShareable, mapAnalysisStatus } from '@/features/share';
import { usePublishSymbolChat } from '@/features/symbol-chat';
import { BotBlockedNotice } from '@/shared/ui/BotBlockedNotice';
import { useCongressTrend } from './hooks/useCongressTrend';
import { buildChatState } from './utils/buildChatState';
import { CongressTrendSummaryError } from './CongressTrendSummaryError';
import { CongressTrendSummarySkeleton } from './CongressTrendSummarySkeleton';
import { CongressTrendSummaryView } from './CongressTrendSummaryView';
import { CongressTrendSummaryEmpty } from './CongressTrendSummaryEmpty';

interface CongressTrendSummaryProps {
    symbol: string;
    /**
     * SSR 스냅샷 프로즈가 같은 AI 결론을 이미 렌더 중일 때 `true`.
     *
     * 이 경우 위젯은 **UI만 숨기고 마운트는 유지**한다. 페이지가 위젯을 아예
     * 렌더하지 않으면 `usePublishSymbolChat`이 돌지 않아 챗봇의 분석 컨텍스트가
     * 비고, 그 결과 "분석이 완료된 후 질문할 수 있어요"로 입력이 잠긴다 —
     * 스냅샷(=분석 결과)이 있을수록 챗이 막히는 역전이 생긴다. 중복 텍스트를
     * 없애려던 원래 의도는 렌더만 건너뛰면 충족되므로, 훅은 그대로 돌려
     * 타입 완전한 분석 결과를 챗 컨텍스트로 publish한다.
     */
    hideView?: boolean;
}

export function CongressTrendSummary({
    symbol,
    hideView = false,
}: CongressTrendSummaryProps) {
    const modelId = useDefaultModelId();
    const reasoning = useDefaultReasoning();
    const isSettingsHydrated = useAnalysisSettingsHydrated();
    const state = useCongressTrend(
        symbol,
        modelId,
        reasoning,
        isSettingsHydrated
    );

    // loading/no_trades/bot_blocked/error 시에도 chatState를 명시적으로
    // publish하여 챗봇이 이전 페이지의 stale context를 그대로 들고 가지
    // 않게 한다. (mirrors FinancialsAiSummary; §17 훅 순서 — usePublishSymbolChat은
    // chatState 파생 변수에 의존하므로 useMemo 뒤에 위치)
    const chatState = useMemo(() => buildChatState(state), [state]);
    usePublishSymbolChat(chatState);
    useRegisterShareable({
        kind: 'congress',
        status: mapAnalysisStatus(state.status),
        result: state.status === 'done' ? state.result : null,
        context: {
            symbol,
            displayName: symbol,
            // CongressTrendResponse has no analyzedAt; resolveAsOf falls back to createdAt.
            analyzedAt: undefined,
        },
        trigger: state.trigger,
    });

    // 훅은 모두 실행된 뒤에 렌더만 건너뛴다 — publish는 유지된다.
    if (hideView) return null;

    if (state.status === 'loading') {
        return <CongressTrendSummarySkeleton />;
    }

    if (state.status === 'no_trades') {
        return <CongressTrendSummaryEmpty />;
    }

    if (state.status === 'bot_blocked') {
        return <BotBlockedNotice />;
    }

    if (state.status === 'error') {
        return (
            <CongressTrendSummaryError
                error={state.error}
                resetErrorBoundary={state.retry}
            />
        );
    }

    return <CongressTrendSummaryView result={state.result} />;
}
