'use server';

import { readLinkAuth } from '../lib/linkAuth';
import { isPriceAlertLaunched } from '../lib/priceAlertConstants';
import type { MailAlertChangeResult, MailAlertLinkAuth } from '../model';
import { createMailAlertDeps } from '../server/createMailAlertDeps';
import { guardMailAlertAction } from '../server/guardMailAlertAction';
import { cancelPriceAlertFlow } from '../server/mailAlertFlows';

const UNAVAILABLE: MailAlertChangeResult = { status: 'unavailable' };

/** 가격대 알림 하나를 지운다. 소유자는 세션, 메일 속 서명 링크(`link`), 쿠키 순으로 서버가 정한다. */
export async function cancelPriceAlertAction(
    alertId: unknown,
    link?: MailAlertLinkAuth
): Promise<MailAlertChangeResult> {
    if (!isPriceAlertLaunched()) return UNAVAILABLE;
    return guardMailAlertAction(
        '[cancelPriceAlertAction] failed:',
        UNAVAILABLE,
        async () =>
            cancelPriceAlertFlow(
                await createMailAlertDeps(),
                alertId,
                readLinkAuth(link)
            )
    );
}
