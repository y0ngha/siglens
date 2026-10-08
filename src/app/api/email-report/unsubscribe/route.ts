import { constants } from 'node:http2';
import { DrizzleEmailReportSubscriptionRepository } from '@/entities/email-report/api';
import { readEmailReportSecret } from '@/entities/email-report/emailReportSecret';
import { REPORT_UNSUBSCRIBE_PAGE_PATH } from '@/entities/email-report/lib/reportLinks';
import { unsubscribeWithSignature } from '@/entities/email-report/unsubscribeWithSignature';
import { getDatabaseClient } from '@/shared/db/client';
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
 * 원클릭 수신거부(RFC 8058). 메일 앱이 `List-Unsubscribe-Post` 헤더를 보고 이 URL로
 * POST한다 — 회원이 메일 앱의 "수신 거부" 버튼을 누른 것이라 확인 단계가 없다.
 */
export async function POST(request: Request): Promise<Response> {
    const url = new URL(request.url);
    try {
        const { db } = getDatabaseClient();
        const outcome = await unsubscribeWithSignature(
            new DrizzleEmailReportSubscriptionRepository(db),
            readEmailReportSecret(),
            url.searchParams.get('u') ?? '',
            url.searchParams.get('sig') ?? ''
        );
        return new Response(null, {
            status: outcome === 'ok' ? HTTP_STATUS_OK : HTTP_STATUS_FORBIDDEN,
            headers: NO_STORE,
        });
    } catch (error) {
        console.error('[email-report] one-click unsubscribe failed', error);
        return new Response(null, {
            status: HTTP_STATUS_SERVICE_UNAVAILABLE,
            headers: NO_STORE,
        });
    }
}

/**
 * 헤더의 URL을 브라우저로 직접 연 경우 — GET으로는 끄지 않고 확인 페이지로 보낸다.
 * 메일 보안 스캐너가 링크를 미리 여는 것만으로 수신이 꺼지면 안 된다.
 */
export function GET(request: Request): Response {
    // `request.url`의 호스트는 프록시 뒤에서 바인드 주소일 수 있어 공개 사이트 주소로 보낸다.
    const target = new URL(REPORT_UNSUBSCRIBE_PAGE_PATH, SITE_URL);
    target.search = new URL(request.url).search;
    return new Response(null, {
        status: HTTP_STATUS_SEE_OTHER,
        headers: { ...NO_STORE, location: target.toString() },
    });
}
