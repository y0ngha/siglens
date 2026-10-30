'use server';

import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getAssetInfo } from '@/entities/ticker/lib/getAssetInfo';
import { getDatabaseClient } from '@/shared/db/client';
import { logActionError } from '@/shared/lib/logActionError';
import { DrizzlePortfolioRepository } from '../api';
import { toView } from '../lib/toView';
import {
    PRICE_SCALE,
    QUANTITY_SCALE,
    validateHoldingInput,
} from '../lib/validateHoldingInput';
import type {
    PortfolioActionErrorCode,
    RawHoldingInput,
    SavePortfolioResult,
} from '../model';

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
 * 서버 액션 인자는 선언된 TypeScript 타입과 무관하게 런타임에 공격자가 통제한다 — 악의적
 * 클라이언트는 임의의 JSON 모양을 보낼 수 있다. 문자열 필드를 가정하는 `validateHoldingInput`의
 * `.trim()`/`.toUpperCase()` 등에 닿기 전에 좁힌다.
 */
function isRawHoldingInputShape(input: unknown): input is RawHoldingInput {
    if (typeof input !== 'object' || input === null) return false;
    return (
        'symbol' in input &&
        typeof input.symbol === 'string' &&
        'quantity' in input &&
        typeof input.quantity === 'string' &&
        'averagePrice' in input &&
        typeof input.averagePrice === 'string'
    );
}

/**
 * 회원의 보유종목을 검증하고 upsert한다. 리다이렉트하지 않는다 — 비로그인은 `unauthenticated`
 * 에러 결과를 받는다. 심볼 존재는 `getAssetInfo`로 확인한다: `null`로 해석되면 저장을
 * 거부(`symbol_not_found`)하지만, 던져진 에러(FMP/DB 장애)는 저장을 막지 않고
 * `companyName`/`fmpSymbol`을 `null`로 두고 진행한다.
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
        // Drizzle 원본 에러의 `.message`에는 바인딩 파라미터(사용자 id, 심볼, 금액)가 들어 있다.
        logActionError('[savePortfolioHoldingAction] upsert failed', error);
        return {
            status: 'error',
            code: 'storage_unavailable',
            message: t('saveFailed'),
        };
    }
}
