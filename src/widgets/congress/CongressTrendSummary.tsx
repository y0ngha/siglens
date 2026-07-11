'use client';

import { useMemo } from 'react';
import {
    useDefaultModelId,
    useDefaultReasoning,
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
}

export function CongressTrendSummary({ symbol }: CongressTrendSummaryProps) {
    const modelId = useDefaultModelId();
    const reasoning = useDefaultReasoning();
    const state = useCongressTrend(symbol, modelId, reasoning);

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
