/**
 * 공지 팝업이 띄울 활성 공지를 `GET /api/notices`에서 읽어 오는 클라이언트 I/O 헬퍼.
 */
import { toNoticeRecord } from '@/entities/notice/lib/toNoticeRecord';
import type {
    NoticeRecord,
    NoticeWireRecord,
} from '@/entities/notice/model/types';

/**
 * 활성 공지를 `GET /api/notices`로 읽는다. 서버 액션(POST)과 달리 캐시 가능한 GET이지만,
 * 엣지에서 공유되는 것은 **`/api/notices`용 CDN 규칙이 추가될 때뿐**이다(지금 Cloudflare 규칙은
 * `/api`를 제외한다 — `app/api/notices/route.ts` JSDoc). 로케일을 쿼리로 넘기는 이유는 그때를
 * 위한 것이다: 캐시 키에 로케일이 들어가야 먼저 캐시된 언어가 다른 언어 방문자에게 가지 않는다.
 *
 * 2xx가 아니면 던진다 — 호출부가 실패를 "공지 없음"과 구분해 기록할 수 있게.
 */
export async function fetchActiveNotices(
    locale: string,
    signal: AbortSignal
): Promise<NoticeRecord[]> {
    const response = await fetch(
        `/api/notices?locale=${encodeURIComponent(locale)}`,
        { signal }
    );
    if (!response.ok) throw new Error(`notices HTTP ${response.status}`);
    const wire = (await response.json()) as NoticeWireRecord[];
    return wire.map(toNoticeRecord);
}
