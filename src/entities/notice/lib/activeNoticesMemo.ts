import 'server-only';
import type { Locale } from '@/shared/i18n/locales';
import {
    __resetMemoryLruForTests,
    createMemoryLru,
} from '@/shared/cache/memoryLru';
import {
    __resetSingleFlightForTests,
    createSingleFlight,
} from '@/shared/lib/singleFlight';
import { MS_PER_MINUTE } from '@/shared/config/time';
import type { NoticeWireRecord } from '../model/types';

/**
 * 활성 공지 메모 TTL. `/api/notices`의 `s-maxage=60`과 같은 값이다 — 새 공지·종료가
 * 화면에 닿기까지의 지연이 CDN 규칙이 붙은 뒤와 지금이 같도록 맞췄다.
 */
export const ACTIVE_NOTICES_MEMO_TTL_MS = MS_PER_MINUTE;

/** 로케일 수만큼만 담긴다 — 상한은 안전장치다. */
const MAX_LOCALES = 8;

const memo = createMemoryLru<NoticeWireRecord[]>(MAX_LOCALES);
const inFlight = createSingleFlight<NoticeWireRecord[]>();

/**
 * 로케일별 활성 공지를 인스턴스 메모리에 60초 둔다.
 *
 * ## 왜 (2026-10)
 *
 * 공지 팝업(`useNoticePopup`)은 모든 페이지 뷰에서 `/api/notices`를 부르고, 라우트는
 * 매번 DB `findActive`(공지 + 번역 조인)를 돌렸다. Cloudflare는 `/api`를 캐시하지 않아
 * `s-maxage`가 효과가 없으므로, 그 60초 창을 오리진 메모리에서 대신 지킨다. 운영이
 * 인스턴스 한 대라 이 메모가 곧 전역 캐시다. 같은 로케일의 동시 miss는 쿼리 한 번으로
 * 접힌다.
 *
 * 무효화: 공지는 앱에서 쓰지 않는다(운영자가 DB에서 직접 넣고 끈다). 그래서 별도 무효화
 * 훅 없이 TTL만으로 충분하고, 반영 지연 상한은 60초다. 조회 실패는 메모하지 않는다 —
 * `load`가 throw하면 그대로 전파돼 호출부가 `no-store` 빈 배열로 응답하고, 다음 요청이
 * 다시 조회한다.
 *
 * 돌려준 배열은 다른 요청과 공유하므로 변경하지 않는다(라우트는 JSON 직렬화만 한다).
 */
export async function getActiveNoticesMemoized(
    locale: Locale,
    load: () => Promise<NoticeWireRecord[]>
): Promise<NoticeWireRecord[]> {
    const hit = memo.get(locale);
    if (hit !== undefined) return hit;
    return inFlight.run(locale, async () => {
        const notices = await load();
        memo.set(locale, notices, ACTIVE_NOTICES_MEMO_TTL_MS);
        return notices;
    });
}

/** 테스트 전용 — 메모와 in-flight 맵을 비운다. */
export function __resetActiveNoticesMemoForTests(): void {
    __resetMemoryLruForTests(memo);
    __resetSingleFlightForTests(inFlight);
}
