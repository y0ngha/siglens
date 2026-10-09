'use server';

import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getAssetInfo } from '@/entities/ticker/lib/getAssetInfo';
import { DrizzleWatchlistRepository } from '@/entities/watchlist/api';
import { WATCHLIST_MAX_MEMBER } from '@/shared/config/watchlist';
import { getDatabaseClient } from '@/shared/db/client';
import { logActionError } from '@/shared/lib/logActionError';
import { isRawWatchlistInput } from '../lib/isRawWatchlistInput';
import { normalizeWatchlistLabel } from '../lib/normalizeWatchlistLabel';
import { toWatchlistView } from '../lib/toWatchlistView';
import { validateWatchlistSymbol } from '../lib/validateWatchlistSymbol';
import type { AddWatchlistResult, RawWatchlistInput } from '../model';

type CompanyNameResolution =
    | { status: 'ok'; companyName: string | null }
    | { status: 'symbol_not_found' };

/**
 * 저장할 표시명을 정한다. `getAssetInfo`가 `null`이면 없는 심볼, **던지면**(FMP·DB 장애)
 * 호출부 라벨로 진행한다 — 이름 하나 때문에 담기가 막히면 안 된다.
 */
async function resolveCompanyName(
    symbol: string,
    label: string
): Promise<CompanyNameResolution> {
    const fallback = normalizeWatchlistLabel(label, symbol);
    try {
        const info = await getAssetInfo(symbol);
        if (info === null) return { status: 'symbol_not_found' };
        return { status: 'ok', companyName: info.name ?? fallback };
    } catch (error) {
        console.warn(
            '[addWatchlistItemAction] symbol verification unavailable, proceeding',
            error
        );
        return { status: 'ok', companyName: fallback };
    }
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
    if (!isRawWatchlistInput(input)) {
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
        const resolved = await resolveCompanyName(symbol, input.label);
        if (resolved.status === 'symbol_not_found') {
            return {
                status: 'error',
                code: 'symbol_not_found',
                message: t('symbolNotFound'),
            };
        }

        // 상한 판정은 저장소가 회원 단위 잠금 안에서 한다 — 개수를 먼저 읽고 따로 넣으면
        // 동시 탭이 둘 다 통과한다. 이미 담긴 심볼은 상한과 무관하게 멱등 성공이다.
        const outcome = await repo.addWithinLimit(
            {
                userId: user.id,
                symbol,
                companyName: resolved.companyName,
            },
            WATCHLIST_MAX_MEMBER
        );
        if (outcome.status === 'limit_reached') {
            return {
                status: 'error',
                code: 'limit_reached',
                message: t('limitReached', { v0: WATCHLIST_MAX_MEMBER }),
            };
        }
        return { status: 'ok', item: toWatchlistView(outcome.item) };
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
