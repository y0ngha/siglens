'use server';

import { isMailAlertLaunched } from '../lib/mailAlertConstants';
import type { MailAlertChangeResult } from '../model';
import { createMailAlertDeps } from '../server/createMailAlertDeps';
import { guardMailAlertAction } from '../server/guardMailAlertAction';
import { setMailAlertIncludePortfolioFlow } from '../server/mailAlertFlows';

const UNAVAILABLE: MailAlertChangeResult = { status: 'unavailable' };

/** 담아 둔 보유 종목과 관심종목의 새 신호도 함께 받을지(회원 전용). */
export async function setMailAlertIncludePortfolioAction(
    value: boolean
): Promise<MailAlertChangeResult> {
    if (!isMailAlertLaunched()) return UNAVAILABLE;
    return guardMailAlertAction(
        '[setMailAlertIncludePortfolioAction] failed:',
        UNAVAILABLE,
        async () =>
            setMailAlertIncludePortfolioFlow(
                await createMailAlertDeps(),
                value === true
            )
    );
}
