'use server';

import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { SYMBOL_EDGE_RE } from '@/shared/config/ticker';
import type { DeletePortfolioResult } from '../model';
import { getTranslations } from 'next-intl/server';

/** Deletes a member's holding by symbol. Never redirects — unauthenticated callers get an `unauthenticated` error result. */
export async function deletePortfolioHoldingAction(
    symbol: string
): Promise<DeletePortfolioResult> {
    const t = await getTranslations('entities.portfolio.action');
    const user = await getCurrentUser();
    if (user === null) {
        return {
            status: 'error',
            code: 'unauthenticated',
            message: t('unauthenticated'),
        };
    }

    // Server-action args are attacker-controlled at runtime regardless of the
    // declared `string` parameter type — a hostile client can post any JSON
    // value. Guard before `.trim()`, which throws a TypeError on non-strings.
    if (typeof symbol !== 'string') {
        return {
            status: 'error',
            code: 'invalid_symbol',
            message: t('invalidSymbolCode'),
        };
    }

    const canonical = symbol.trim().toUpperCase();
    // 삭제는 **저장 시점의 규칙이 아니라 DB 키 안전성만** 본다 — 형상 superset인
    // `SYMBOL_EDGE_RE`를 직접 쓴다.
    //
    // `isAdmissibleSymbolShape`을 쓰면 안 되는 이유: 그 함수는 "지금 이 심볼을 조회·색인할
    // 가치가 있는가"라는 **admission** 판정이고, 해외 거래소 접미사를 거부하도록 좁혀졌다
    // (2026-07-26). 그런데 `savePortfolioHoldingAction`은 `getAssetInfo` throw를 삼키고
    // 저장을 진행하므로 `HVO.L` 같은 행이 이미 `portfolio_holdings`에 들어가 있을 수 있다.
    // admission 판정을 삭제 게이트로 재사용하면 그 행들이 `invalid_symbol`로 거부돼
    // **영구 삭제 불가** 상태가 된다(리포지토리는 `deleteByUserAndSymbol`만 노출).
    // 이미 저장된 데이터를 지우는 연산은 저장 당시보다 엄격해져선 안 된다.
    if (!SYMBOL_EDGE_RE.test(canonical)) {
        return {
            status: 'error',
            code: 'invalid_symbol',
            message: t('invalidSymbolCode'),
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
            message: t('deleteFailed'),
        };
    }
}
