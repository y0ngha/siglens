'use server';

import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/entities/auth/server/getCurrentUser';
import { SYMBOL_EDGE_RE } from '@/shared/config/ticker';
import { getDatabaseClient } from '@/shared/db/client';
import { logActionError } from '@/shared/lib/logActionError';
import { DrizzlePortfolioRepository } from '../api';
import type { DeletePortfolioResult } from '../model';

/** 회원의 보유종목을 심볼로 삭제한다. 리다이렉트하지 않는다 — 비로그인은 `unauthenticated` 에러 결과를 받는다. */
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

    // 서버 액션 인자는 선언된 `string` 타입과 무관하게 런타임에 공격자가 통제한다 — 악의적
    // 클라이언트는 임의의 JSON 값을 보낼 수 있다. 비문자열에서 TypeError를 내는 `.trim()` 전에 거른다.
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
        // Drizzle 원본 에러의 `.message`에는 바인딩 파라미터(사용자 id, 심볼, 금액)가 들어 있다.
        logActionError('[deletePortfolioHoldingAction] delete failed', error);
        return {
            status: 'error',
            code: 'storage_unavailable',
            message: t('deleteFailed'),
        };
    }
}
