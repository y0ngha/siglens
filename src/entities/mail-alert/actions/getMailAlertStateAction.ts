'use server';

import { isMailAlertLaunched } from '../lib/mailAlertConstants';
import type { MailAlertState } from '../model';
import { createMailAlertDeps } from '../server/createMailAlertDeps';
import { guardMailAlertAction } from '../server/guardMailAlertAction';
import { getMailAlertState } from '../server/mailAlertFlows';

const UNAVAILABLE: MailAlertState = { status: 'unavailable' };

/** 대화상자가 열릴 때 이 화면 항목의 상태를 읽는다. 공개 전에는 아무것도 읽지 않고 `unavailable`이다. */
export async function getMailAlertStateAction(
    topicInput: unknown
): Promise<MailAlertState> {
    if (!isMailAlertLaunched()) return UNAVAILABLE;
    return guardMailAlertAction(
        '[getMailAlertStateAction] failed:',
        UNAVAILABLE,
        async () => getMailAlertState(await createMailAlertDeps(), topicInput)
    );
}
