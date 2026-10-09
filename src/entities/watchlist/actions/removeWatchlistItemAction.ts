'use server';

import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { DrizzleWatchlistRepository } from '@/entities/watchlist/api';
import { SYMBOL_EDGE_RE } from '@/shared/config/ticker';
import { getDatabaseClient } from '@/shared/db/client';
import { logActionError } from '@/shared/lib/logActionError';
import type { RemoveWatchlistResult } from '../model';

/**
 * 관심종목에서 한 건 뺀다. 삭제는 저장 시점의 admission 규칙이 아니라 **DB 키 안전성**
 * (`SYMBOL_EDGE_RE`)만 본다 — `deletePortfolioHoldingAction`과 같은 이유로, FMP 장애 중
 * 저장된 해외 접미사 심볼이 영구 삭제 불가가 되면 안 된다.
 */
export async function removeWatchlistItemAction(
    symbol: string
): Promise<RemoveWatchlistResult> {
    const t = await getTranslations('entities.watchlist.action');
    const user = await getCurrentUser();
    if (user === null) {
        return {
            status: 'error',
            code: 'unauthenticated',
            message: t('unauthenticated'),
        };
    }
    if (typeof symbol !== 'string') {
        return {
            status: 'error',
            code: 'invalid_symbol',
            message: t('invalidInput'),
        };
    }
    const canonical = symbol.trim().toUpperCase();
    if (!SYMBOL_EDGE_RE.test(canonical)) {
        return {
            status: 'error',
            code: 'invalid_symbol',
            message: t('invalidSymbol'),
        };
    }
    try {
        const { db } = getDatabaseClient();
        await new DrizzleWatchlistRepository(db).remove(user.id, canonical);
        return { status: 'ok' };
    } catch (error) {
        logActionError('[removeWatchlistItemAction] remove failed', error);
        return {
            status: 'error',
            code: 'storage_unavailable',
            message: t('deleteFailed'),
        };
    }
}
