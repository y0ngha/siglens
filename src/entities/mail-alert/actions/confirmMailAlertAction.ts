'use server';

import { isMailAlertLaunched } from '../lib/mailAlertConstants';
import { readFormText } from '../lib/readFormText';
import type { MailAlertConfirmState } from '../model';
import { createMailAlertDeps } from '../server/createMailAlertDeps';
import { guardMailAlertAction } from '../server/guardMailAlertAction';
import { confirmMailAlertFlow } from '../server/mailAlertFlows';

const UNAVAILABLE: MailAlertConfirmState = { status: 'unavailable' };

/**
 * 2단계: 코드를 확인해 구독자와 이 화면의 항목을 만들고, 같은 브라우저용 쿠키를 심는다. 항목은 폼의
 * `kind`와 그에 맞는 필드(`symbol`·`signalType`·`market`)로 온다.
 */
export async function confirmMailAlertAction(
    _prev: MailAlertConfirmState,
    formData: FormData
): Promise<MailAlertConfirmState> {
    if (!isMailAlertLaunched()) return UNAVAILABLE;
    return guardMailAlertAction(
        '[confirmMailAlertAction] failed:',
        UNAVAILABLE,
        async () =>
            confirmMailAlertFlow(await createMailAlertDeps(), {
                email: readFormText(formData, 'email'),
                code: readFormText(formData, 'code'),
                topicInput: formData,
            })
    );
}
