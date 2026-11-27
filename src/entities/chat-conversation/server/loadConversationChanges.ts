import 'server-only';
import { changeReferenceOf } from '@y0ngha/siglens-core';
import { marketProfileForAssetInfo } from '@/entities/ticker/lib/resolveMarketProfile';
import { getAssetInfo } from '@/entities/ticker/server/getAssetInfo';
import { logActionError } from '@/shared/lib/logActionError';
import { withConcurrencyLimit } from '@/shared/lib/withConcurrencyLimit';
import { withTimeout } from '@/shared/lib/withTimeout';
import { buildSymbolChanges } from '../lib/buildSymbolChanges';
import type { ChatSymbolChangesResult } from '../types';
import {
    CONVERSATION_CHANGES_MAX_SYMBOLS,
    extractConversationAnalyses,
    type ConversationAnalysis,
} from './conversationAnalyses';
import { loadClosedDailyBars } from './closedDailyBars';

/** 한 종목을 계산하는 데 쓰는 시간 상한(ms). 넘기면 그 종목은 카드에서 빠진다 — 다시 연 대화를 늦추지 않는다. */
export const CONVERSATION_CHANGES_TIMEOUT_MS = 3_000;

type ConversationRows = Parameters<typeof extractConversationAnalyses>[0];

async function loadOne(
    analysis: ConversationAnalysis
): Promise<ChatSymbolChangesResult | null> {
    const reference = changeReferenceOf(analysis.analysis, 'as_shown', {
        analyzedAt: analysis.generatedAt,
    });
    if (reference === null) return null;
    const { symbol } = analysis;
    const asset = await getAssetInfo(symbol);
    const marketProfile = marketProfileForAssetInfo(asset);
    const { bars, session } = await loadClosedDailyBars(
        symbol,
        marketProfile,
        asset?.fmpSymbol
    );
    return buildSymbolChanges({
        symbol,
        marketProfile,
        analyzedAt: analysis.generatedAt,
        reference,
        session,
        bars,
    });
}

/**
 * 저장된 대화의 일봉 기술적 분석마다 "그 분석 이후 달라진 점"을 계산한다. 종목별로 따로 시간 상한을
 * 걸고, 실패한 종목은 로그만 남기고 뺀다. 아무것도 저장하지 않는다.
 */
export async function loadConversationChanges(
    rows: ConversationRows
): Promise<ChatSymbolChangesResult[]> {
    // 카드는 최근에 본 종목부터 상한까지만 — 한 번에 그 수만큼 함께 계산한다(CC-1, 동시 수 = 종목 상한).
    const analyses = extractConversationAnalyses(rows).slice(
        0,
        CONVERSATION_CHANGES_MAX_SYMBOLS
    );
    const settled = await withConcurrencyLimit(
        analyses,
        CONVERSATION_CHANGES_MAX_SYMBOLS,
        analysis =>
            withTimeout(
                loadOne(analysis),
                CONVERSATION_CHANGES_TIMEOUT_MS,
                null
            )
    );
    return settled.flatMap(result => {
        if (result.status === 'rejected') {
            logActionError(
                '[loadConversationChanges] symbol failed',
                result.reason
            );
            return [];
        }
        return result.value === null ? [] : [result.value];
    });
}
