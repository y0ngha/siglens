'use server';

import { isMailAlertLaunched } from '../lib/mailAlertConstants';
import type { MailAlertConfirmState } from '../model';
import { createMailAlertDeps } from '../server/createMailAlertDeps';
import { guardMailAlertAction } from '../server/guardMailAlertAction';
import { confirmMailAlertFlow } from '../server/mailAlertFlows';

const UNAVAILABLE: MailAlertConfirmState = { status: 'unavailable' };

function readText(formData: FormData, name: string): string {
    const value = formData.get(name);
    return typeof value === 'string' ? value : '';
}

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
                email: readText(formData, 'email'),
                code: readText(formData, 'code'),
                topicInput: formData,
            })
    );
}
