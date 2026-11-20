import type { LandingSite } from '@/entities/visitor/types';
import { LOCALES } from '@/shared/i18n/locales';

/**
 * 경로에 불투명한 식별자가 실리는 페이지. 저장 전에 식별자 세그먼트를 `:id`로 접는다 — 방문 행이
 * 400일 보관되고 `share_opened` 같은 이벤트와 (해시, 날짜)로 이어지므로, 원본 경로를 두면 공유
 * 링크나 대화 id가 되살아난다. 종목 코드·로케일·가이드 슬러그는 콘텐츠라 그대로 둔다. 쿼리의 토큰
 * (비밀번호 재설정·수신거부)은 `landingPathOf`가 이미 버린다.
 *
 * 새 식별자 경로를 만들면 여기에 한 줄을 더한다(경로별 테스트 `collapseLandingPath.test.ts`).
 * `/c/<id>`는 ai 호스트에서만 접는다 — 메인 호스트에서는 `/c/news`가 종목 C의 탭일 수 있다.
 */
const LOCALE_PREFIX = `(/(?:${LOCALES.join('|')}))?`;

const IDENTIFIER_PATHS: ReadonlyArray<{
    readonly site: LandingSite;
    readonly pattern: RegExp;
    readonly replacement: string;
}> = [
    {
        site: 'main',
        pattern: new RegExp(`^${LOCALE_PREFIX}/share/[^/]+(?:/.*)?$`),
        replacement: '$1/share/:id',
    },
    {
        site: 'ai',
        pattern: new RegExp(`^${LOCALE_PREFIX}/c/[^/]+(?:/.*)?$`),
        replacement: '$1/c/:id',
    },
];

/** 저장할 경로. 식별자 세그먼트를 접은 값이고, 해당 없으면 입력 그대로다. */
export function collapseLandingPath(
    path: string | null,
    site: LandingSite | null
): string | null {
    if (path === null || site === null) return path;
    const rule = IDENTIFIER_PATHS.find(
        ({ site: ruleSite, pattern }) => ruleSite === site && pattern.test(path)
    );
    return rule === undefined
        ? path
        : path.replace(rule.pattern, rule.replacement);
}
