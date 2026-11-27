'use server';

import { isPriceAlertLaunched } from '../lib/priceAlertConstants';
import type { PriceAlertConfirmState } from '../model';
import { createPriceAlertDeps } from '../server/createPriceAlertDeps';
import { guardMailAlertAction } from '../server/guardMailAlertAction';
import { confirmPriceAlertFlow } from '../server/priceAlertFlows';

const UNAVAILABLE: PriceAlertConfirmState = { status: 'unavailable' };

function readText(formData: FormData, name: string): string {
    const value = formData.get(name);
    return typeof value === 'string' ? value : '';
}

/**
 * 코드로 주소를 확인하고 이 제안의 알림을 만든다(코드 단계의 폼 제출). 제안은 폼의 `token`으로 오고, 코드를 쓰기
 * 전에 서명·만료·소유자를 먼저 확인한다.
 */
export async function confirmPriceAlertAction(
    _prev: PriceAlertConfirmState,
    formData: FormData
): Promise<PriceAlertConfirmState> {
    if (!isPriceAlertLaunched()) return UNAVAILABLE;
    return guardMailAlertAction(
        '[confirmPriceAlertAction] failed:',
        UNAVAILABLE,
        async () =>
            confirmPriceAlertFlow(await createPriceAlertDeps(), {
                email: readText(formData, 'email'),
                code: readText(formData, 'code'),
                token: readText(formData, 'token'),
            })
    );
}
