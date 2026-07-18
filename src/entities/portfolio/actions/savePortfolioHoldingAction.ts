'use server';

import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { getAssetInfo } from '@/entities/ticker/lib/getAssetInfo';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { validateHoldingInput } from '../lib/validateHoldingInput';
import { toView } from '../lib/toView';
import type { RawHoldingInput, SavePortfolioResult } from '../model';

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
    const user = await getCurrentUser();
    if (user === null) {
        return {
            status: 'error',
            code: 'unauthenticated',
            message: '로그인이 필요합니다.',
        };
    }

    if (!isRawHoldingInputShape(input)) {
        return {
            status: 'error',
            code: 'invalid_symbol',
            message: '유효하지 않은 입력입니다.',
        };
    }

    const v = validateHoldingInput(input);
    if (!v.ok) return { status: 'error', code: v.code, message: v.message };

    let companyName: string | null = null;
    let fmpSymbol: string | null = null;
    try {
        const info = await getAssetInfo(v.symbol);
        if (info === null) {
            return {
                status: 'error',
                code: 'symbol_not_found',
                message: '존재하지 않는 종목입니다.',
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
            message: '저장에 실패했어요. 잠시 후 다시 시도해 주세요.',
        };
    }
}
