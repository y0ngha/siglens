'use server';

import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { getAssetInfo } from '@/entities/ticker/lib/getAssetInfo';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import {
    validateHoldingInput,
    QUANTITY_SCALE,
    PRICE_SCALE,
} from '../lib/validateHoldingInput';
import { toView } from '../lib/toView';
import type {
    PortfolioActionErrorCode,
    RawHoldingInput,
    SavePortfolioResult,
} from '../model';
import { getTranslations } from 'next-intl/server';

/**
 * `validateHoldingInput`이 돌려주는 코드 → `entities.portfolio.action` 키.
 *
 * 세 코드만 나온다 — 나머지 `PortfolioActionErrorCode`는 이 액션이 직접 만든다.
 * 소수 자릿수는 문구에 굳히지 않고 값으로 넘긴다: 예전에는 "소수점 8자리까지"가
 * 문자열에 박혀 있어 `QUANTITY_SCALE`을 바꿔도 조용히 어긋났다.
 */
const VALIDATION_MESSAGE_KEY: Partial<
    Record<PortfolioActionErrorCode, string>
> = {
    invalid_symbol: 'invalidSymbol',
    invalid_quantity: 'invalidQuantity',
    invalid_price: 'invalidPrice',
};

const SCALE_FOR_CODE: Partial<Record<PortfolioActionErrorCode, number>> = {
    invalid_quantity: QUANTITY_SCALE,
    invalid_price: PRICE_SCALE,
};

/**
 * Server-action arguments are attacker-controlled at runtime regardless of
 * the declared TypeScript parameter type — a hostile client can post any
 * JSON shape. Narrow before touching `.trim()`/`.toUpperCase()` etc. inside
 * `validateHoldingInput`, which assumes string fields.
 */
function isRawHoldingInputShape(input: unknown): input is RawHoldingInput {
    if (typeof input !== 'object' || input === null) return false;
    const candidate = input as Record<string, unknown>;
    return (
        typeof candidate.symbol === 'string' &&
        typeof candidate.quantity === 'string' &&
        typeof candidate.averagePrice === 'string'
    );
}

/**
 * Validates and upserts a member's holding. Never redirects — unauthenticated
 * callers get an `unauthenticated` error result. Symbol existence is verified
 * via `getAssetInfo`: a resolved `null` rejects the save (`symbol_not_found`),
 * but a thrown error (FMP/DB outage) degrades gracefully and proceeds with
 * `companyName`/`fmpSymbol` set to `null` rather than blocking the save.
 */
export async function savePortfolioHoldingAction(
    input: RawHoldingInput
): Promise<SavePortfolioResult> {
    const t = await getTranslations('entities.portfolio.action');
    const user = await getCurrentUser();
    if (user === null) {
        return {
            status: 'error',
            code: 'unauthenticated',
            message: t('unauthenticated'),
        };
    }

    if (!isRawHoldingInputShape(input)) {
        return {
            status: 'error',
            code: 'invalid_symbol',
            message: t('invalidInput'),
        };
    }

    const v = validateHoldingInput(input);
    if (!v.ok) {
        return {
            status: 'error',
            code: v.code,
            message: t(VALIDATION_MESSAGE_KEY[v.code] ?? 'invalidInput', {
                v0: SCALE_FOR_CODE[v.code] ?? 0,
            }),
        };
    }

    let companyName: string | null = null;
    let fmpSymbol: string | null = null;
    try {
        const info = await getAssetInfo(v.symbol);
        if (info === null) {
            return {
                status: 'error',
                code: 'symbol_not_found',
                message: t('symbolNotFound'),
            };
        }
        companyName = info.name ?? null;
        fmpSymbol = info.fmpSymbol ?? null;
    } catch (error) {
        console.warn(
            '[savePortfolioHoldingAction] symbol verification unavailable, proceeding',
            error
        );
    }

    try {
        const { db } = getDatabaseClient();
        const row = await new DrizzlePortfolioRepository(db).upsert({
            userId: user.id,
            symbol: v.symbol,
            companyName,
            fmpSymbol,
            quantity: v.quantity,
            averagePrice: v.averagePrice,
        });
        return { status: 'ok', holding: toView(row) };
    } catch (error) {
        console.error('[savePortfolioHoldingAction] upsert failed', error);
        return {
            status: 'error',
            code: 'storage_unavailable',
            message: t('saveFailed'),
        };
    }
}
