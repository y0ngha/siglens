/**
 * 공지의 외부 링크(`linkUrl`·`linkLabel`)를 렌더 가능한 형태로 정리하는 순수 헬퍼.
 */
import { toSafeHttpUrl } from '@/shared/lib/safeUrl';

/** 렌더할 공지 링크 — `href`는 http(s)만, `label`은 비어 있지 않은 문구다. */
export interface NoticeLink {
    href: string;
    label: string;
}

/**
 * http(s)가 아닌 URL(`javascript:` 등)이면 링크를 아예 그리지 않는다(`null`).
 *
 * 라벨이 없거나 공백뿐이면 URL을 라벨로 쓴다 — 빈 문자열을 그대로 쓰면 이름 없는 빈
 * 버튼이 되어 보이지도, 스크린 리더로 읽히지도 않는다. 운영자가 SQL로 넣는 컬럼이라
 * `NULL` 대신 `''`가 들어올 수 있다.
 */
export function resolveNoticeLink(
    linkUrl: string | null,
    linkLabel: string | null
): NoticeLink | null {
    const href = toSafeHttpUrl(linkUrl);
    if (href === null) return null;
    const trimmedLabel = linkLabel?.trim() ?? '';
    return { href, label: trimmedLabel === '' ? href : trimmedLabel };
}
