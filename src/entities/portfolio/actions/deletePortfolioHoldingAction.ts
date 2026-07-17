'use server';

import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import type { DeletePortfolioResult } from '../model';

/** Deletes a member's holding by symbol. Never redirects — unauthenticated callers get an `unauthenticated` error result. */
export async function deletePortfolioHoldingAction(
    symbol: string
): Promise<DeletePortfolioResult> {
    const user = await getCurrentUser();
    if (user === null) {
        return {
            status: 'error',
            code: 'unauthenticated',
            message: '로그인이 필요합니다.',
        };
    }

    const canonical = symbol.trim().toUpperCase();
    if (!isAdmissibleSymbolShape(canonical)) {
        return {
            status: 'error',
            code: 'invalid_symbol',
            message: '유효하지 않은 종목 코드입니다.',
        };
    }

    try {
        const { db } = getDatabaseClient();
        await new DrizzlePortfolioRepository(db).deleteByUserAndSymbol(
            user.id,
            canonical
        );
        return { status: 'ok' };
    } catch (error) {
        console.error('[deletePortfolioHoldingAction] delete failed', error);
        return {
            status: 'error',
            code: 'storage_unavailable',
            message: '삭제에 실패했어요. 잠시 후 다시 시도해 주세요.',
        };
    }
}
