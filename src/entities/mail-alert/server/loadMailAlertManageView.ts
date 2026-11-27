import 'server-only';

import { isMailAlertLaunched } from '../lib/mailAlertConstants';
import type { MailAlertLinkAuth } from '../model';
import { createMailAlertDeps } from './createMailAlertDeps';
import { guardMailAlertAction } from './guardMailAlertAction';
import {
    loadMailAlertManage,
    type MailAlertManageLoad,
} from './mailAlertFlows';

const UNAVAILABLE: MailAlertManageLoad = { status: 'unavailable' };

/**
 * 설정 화면(`/email-report/alerts`)이 렌더 때 읽는 현재 상태. 세션 → 서명 링크 → 쿠키 순으로 소유자를
 * 정하고, 공개 전이거나 테이블이 없으면 `unavailable`이다.
 */
export async function loadMailAlertManageView(
    link: MailAlertLinkAuth | undefined
): Promise<MailAlertManageLoad> {
    if (!isMailAlertLaunched()) return UNAVAILABLE;
    return guardMailAlertAction(
        '[loadMailAlertManageView] failed:',
        UNAVAILABLE,
        async () => {
            const deps = await createMailAlertDeps();
            // 렌더 중에는 쿠키를 쓰지 않는다 — 읽기만 내밀고 `write`·`clear`는 넘기지 않는다.
            return loadMailAlertManage(
                { ...deps, guestCookie: { read: deps.guestCookie.read } },
                link
            );
        }
    );
}
