'use server';

import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { DrizzleWatchlistRepository } from '@/entities/watchlist/api';
import {
    WATCHLIST_MAX_LOCAL,
    WATCHLIST_MAX_MEMBER,
} from '@/shared/config/watchlist';
import { getDatabaseClient } from '@/shared/db/client';
import type { MergeWatchlistCandidate } from '@/shared/db/types';
import { logActionError } from '@/shared/lib/logActionError';
import { normalizeWatchlistLabel } from '../lib/normalizeWatchlistLabel';
import { validateWatchlistSymbol } from '../lib/validateWatchlistSymbol';
import type { MergeWatchlistResult, RawWatchlistInput } from '../model';

function isRawWatchlistInputShape(input: unknown): input is RawWatchlistInput {
    if (typeof input !== 'object' || input === null) return false;
    const candidate = input as Record<string, unknown>;
    return (
        typeof candidate.symbol === 'string' &&
        typeof candidate.label === 'string'
    );
}

function toCandidate(entry: RawWatchlistInput): MergeWatchlistCandidate[] {
    const validated = validateWatchlistSymbol(entry.symbol);
    if (!validated.ok) return [];
    const companyName = normalizeWatchlistLabel(entry.label, validated.symbol);
    return [{ symbol: validated.symbol, companyName }];
}

/**
 * 로그인 확정 직후 로컬 관심종목을 계정에 합친다(설계 §5). 입력은 **최근 담은 순**이어야
 * 상한 초과분이 오래된 것부터 버려진다. 심볼 존재 검증(`getAssetInfo`)은 하지 않는다 —
 * 가입 직후 첫 화면에서 최대 20건의 FMP 팬아웃을 돌리지 않기 위해서다. 형상이 깨진 항목만
 * 버리고, 로컬 상한을 넘는 꼬리는 받지 않는다(저장 용량 공격 방지).
 */
export async function mergeWatchlistAction(
    entries: RawWatchlistInput[]
): Promise<MergeWatchlistResult> {
    const t = await getTranslations('entities.watchlist.action');
    const user = await getCurrentUser();
    if (user === null) {
        return {
            status: 'error',
            code: 'unauthenticated',
            message: t('unauthenticated'),
        };
    }
    if (!Array.isArray(entries)) {
        return {
            status: 'error',
            code: 'invalid_symbol',
            message: t('invalidInput'),
        };
    }
    const candidates = entries
        .filter(isRawWatchlistInputShape)
        .flatMap(toCandidate)
        .slice(0, WATCHLIST_MAX_LOCAL);

    try {
        const { db } = getDatabaseClient();
        const outcome = await new DrizzleWatchlistRepository(db).mergeSymbols(
            user.id,
            candidates,
            WATCHLIST_MAX_MEMBER
        );
        return { status: 'ok', added: outcome.added, skipped: outcome.skipped };
    } catch (error) {
        logActionError('[mergeWatchlistAction] merge failed', error);
        return {
            status: 'error',
            code: 'storage_unavailable',
            message: t('mergeFailed'),
        };
    }
}
