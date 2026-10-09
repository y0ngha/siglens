'use server';

import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getAssetInfo } from '@/entities/ticker/lib/getAssetInfo';
import { DrizzleWatchlistRepository } from '@/entities/watchlist/api';
import { WATCHLIST_MAX_MEMBER } from '@/shared/config/watchlist';
import { getDatabaseClient } from '@/shared/db/client';
import { logActionError } from '@/shared/lib/logActionError';
import { normalizeWatchlistLabel } from '../lib/normalizeWatchlistLabel';
import { toWatchlistView } from '../lib/toWatchlistView';
import { validateWatchlistSymbol } from '../lib/validateWatchlistSymbol';
import type { AddWatchlistResult, RawWatchlistInput } from '../model';

/** 서버 액션 인자는 런타임에 공격자가 정한다 — `.trim()` 전에 좁힌다. */
function isRawWatchlistInputShape(input: unknown): input is RawWatchlistInput {
    if (typeof input !== 'object' || input === null) return false;
    const candidate = input as Record<string, unknown>;
    return (
        typeof candidate.symbol === 'string' &&
        typeof candidate.label === 'string'
    );
}

/**
 * 회원 관심종목에 한 건 담는다. 비로그인은 `unauthenticated` 결과. 심볼 존재는
 * `getAssetInfo`로 본다(보유 액션과 동일): `null`이면 `symbol_not_found`, **던지면**(FMP·DB
 * 장애) 호출부가 넘긴 표시명으로 저장을 진행한다 — 이름 하나 때문에 담기가 막히면 안 된다.
 */
export async function addWatchlistItemAction(
    input: RawWatchlistInput
): Promise<AddWatchlistResult> {
    const t = await getTranslations('entities.watchlist.action');
    const user = await getCurrentUser();
    if (user === null) {
        return {
            status: 'error',
            code: 'unauthenticated',
            message: t('unauthenticated'),
        };
    }
    if (!isRawWatchlistInputShape(input)) {
        return {
            status: 'error',
            code: 'invalid_symbol',
            message: t('invalidInput'),
        };
    }
    const validated = validateWatchlistSymbol(input.symbol);
    if (!validated.ok) {
        return {
            status: 'error',
            code: 'invalid_symbol',
            message: t('invalidSymbol'),
        };
    }
    const { symbol } = validated;

    try {
        const { db } = getDatabaseClient();
        const repo = new DrizzleWatchlistRepository(db);
        if ((await repo.countByUser(user.id)) >= WATCHLIST_MAX_MEMBER) {
            return {
                status: 'error',
                code: 'limit_reached',
                message: t('limitReached', { v0: WATCHLIST_MAX_MEMBER }),
            };
        }

        let companyName = normalizeWatchlistLabel(input.label, symbol);
        try {
            const info = await getAssetInfo(symbol);
            if (info === null) {
                return {
                    status: 'error',
                    code: 'symbol_not_found',
                    message: t('symbolNotFound'),
                };
            }
            companyName = info.name ?? companyName;
        } catch (error) {
            console.warn(
                '[addWatchlistItemAction] symbol verification unavailable, proceeding',
                error
            );
        }

        const row = await repo.add({ userId: user.id, symbol, companyName });
        return { status: 'ok', item: toWatchlistView(row) };
    } catch (error) {
        // Drizzle 오류 메시지는 바인딩 파라미터(user id·심볼)를 품는다 — 코드만 남긴다.
        logActionError('[addWatchlistItemAction] add failed', error);
        return {
            status: 'error',
            code: 'storage_unavailable',
            message: t('saveFailed'),
        };
    }
}
