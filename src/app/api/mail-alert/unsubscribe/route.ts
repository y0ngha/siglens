import { constants } from 'node:http2';
import { readEmailReportSecret } from '@/entities/email-report/emailReportSecret';
import { DrizzleMailAlertSubscriberRepository } from '@/entities/mail-alert/api';
import { isMissingTableError } from '@/entities/mail-alert/lib/dbErrorKind';
import {
    buildMailAlertUnsubscribePageUrl,
    MAIL_ALERT_MANAGE_PATH,
    verifyMailAlertUnsubscribe,
} from '@/entities/mail-alert/lib/mailAlertLinks';
import { unsubscribeWithAlertSignature } from '@/entities/mail-alert/server/unsubscribeWithAlertSignature';
import { getDatabaseClient } from '@/shared/db/client';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';
import { DEFAULT_LOCALE, isLocale, localePath } from '@/shared/i18n/locales';
import { SITE_URL } from '@/shared/lib/seo';

const {
    HTTP_STATUS_OK,
    HTTP_STATUS_FORBIDDEN,
    HTTP_STATUS_SEE_OTHER,
    HTTP_STATUS_SERVICE_UNAVAILABLE,
} = constants;

export const dynamic = 'force-dynamic';

const NO_STORE = { 'cache-control': 'no-store' };

/**
 * 원클릭 수신거부(RFC 8058). 메일 앱이 `List-Unsubscribe-Post` 헤더를 보고 이 URL로 POST한다 — 수신자가 메일
 * 앱의 "수신 거부" 버튼을 누른 것이라 확인 단계가 없다. 공개 스위치와 무관하게 동작한다: 이미 나간 메일의
 * 링크는 스위치가 꺼진 뒤에도 수신을 끊을 수 있어야 한다. 테이블이 없는 환경은 지울 것이 없고 서명이 유효할 수도
 * 없으므로 `403`이다.
 */
export async function POST(request: Request): Promise<Response> {
    const url = new URL(request.url);
    try {
        const { db } = getDatabaseClient();
        const outcome = await unsubscribeWithAlertSignature(
            new DrizzleMailAlertSubscriberRepository(db),
            readEmailReportSecret(),
            url.searchParams.get('s') ?? '',
            url.searchParams.get('sig') ?? ''
        );
        return new Response(null, {
            status: outcome === 'ok' ? HTTP_STATUS_OK : HTTP_STATUS_FORBIDDEN,
            headers: NO_STORE,
        });
    } catch (error) {
        if (isMissingTableError(error)) {
            return new Response(null, {
                status: HTTP_STATUS_FORBIDDEN,
                headers: NO_STORE,
            });
        }
        console.error(
            '[mail-alert] one-click unsubscribe failed',
            redactDbErrorForLog(error)
        );
        return new Response(null, {
            status: HTTP_STATUS_SERVICE_UNAVAILABLE,
            headers: NO_STORE,
        });
    }
}

/**
 * 헤더의 URL을 브라우저로 직접 연 경우 — GET으로는 지우지 않고 설정 페이지의 수신거부 구역으로 보낸다.
 * 메일 보안 스캐너가 링크를 미리 여는 것만으로 구독이 지워지면 안 된다. 서명(`alert-unsubscribe`)이 맞을 때만
 * 같은 구독자의 설정 링크(`alert-manage`)를 새로 만들어 보내고, 그렇지 않으면 링크 없는 설정 페이지로 보낸다
 * (거기서는 "메일 속 링크로 열어 주세요" 안내가 나온다).
 */
export function GET(request: Request): Response {
    const params = new URL(request.url).searchParams;
    const subscriberId = params.get('s') ?? '';
    // 메일이 실은 로케일(`l`). 없거나 모르는 값이면 기본 언어다. 서명 대상이 아니라 권한과 무관하다.
    const rawLocale = params.get('l') ?? '';
    const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
    const secret = readEmailReportSecret();
    // `request.url`의 호스트는 프록시 뒤에서 바인드 주소일 수 있어 공개 사이트 주소로 보낸다.
    const location =
        secret !== null &&
        verifyMailAlertUnsubscribe(
            secret,
            subscriberId,
            params.get('sig') ?? ''
        )
            ? buildMailAlertUnsubscribePageUrl(
                  SITE_URL,
                  secret,
                  locale,
                  subscriberId
              )
            : new URL(
                  localePath(locale, MAIL_ALERT_MANAGE_PATH),
                  SITE_URL
              ).toString();
    return new Response(null, {
        status: HTTP_STATUS_SEE_OTHER,
        headers: { ...NO_STORE, location },
    });
}
