'use server';

import { isMailAlertLaunched } from '../lib/mailAlertConstants';
import type { MailAlertAddResult } from '../model';
import { createMailAlertDeps } from '../server/createMailAlertDeps';
import { guardMailAlertAction } from '../server/guardMailAlertAction';
import { addMailAlertTopicFlow } from '../server/mailAlertFlows';

const UNAVAILABLE: MailAlertAddResult = { status: 'unavailable' };

/**
 * 코드 없이 항목을 더한다 — 이메일이 인증된 회원(세션)이나 같은 브라우저의 쿠키가 있을 때만이다.
 * `includePortfolio`는 회원이 "담아 둔 종목도 함께 받기"를 고른 경우다.
 */
export async function addMailAlertTopicAction(
    topicInput: unknown,
    includePortfolio: boolean
): Promise<MailAlertAddResult> {
    if (!isMailAlertLaunched()) return UNAVAILABLE;
    return guardMailAlertAction(
        '[addMailAlertTopicAction] failed:',
        UNAVAILABLE,
        async () =>
            addMailAlertTopicFlow(await createMailAlertDeps(), topicInput, {
                includePortfolio: includePortfolio === true,
            })
    );
}
