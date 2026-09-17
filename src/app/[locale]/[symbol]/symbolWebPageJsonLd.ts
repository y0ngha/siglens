import { buildWebPageJsonLd, ORGANIZATION_JSON_LD_ID } from '@/shared/lib/seo';

type WebPageParams = Parameters<typeof buildWebPageJsonLd>[0];

interface SymbolWebPageParams extends WebPageParams {
    /**
     * 이 탭이 **실제로 렌더한** 스냅샷의 생성 시각. 없으면 `dateModified`를
     * 아예 싣지 않는다.
     *
     * 빌드 시각·오늘 날짜 같은 대체값을 채우지 않는 이유: 그 값은 페이지 내용이
     * 바뀌었다는 뜻이 아니라 "크롤된 날"이라, 모든 심볼 탭이 매일 갱신된다고
     * 주장하는 거짓 신선도 신호가 된다(2026-09-17 정책 감사 M2). 스냅샷이 없는
     * 탭은 신선도를 주장할 근거 자체가 없으므로 필드를 생략한다.
     */
    generatedAt?: Date | string | null;
}

/**
 * 심볼 탭 9개가 공유하는 `WebPage` 노드 — `buildWebPageJsonLd`에 YMYL 신뢰 신호
 * 두 가지(`dateModified`·`publisher`)를 얹는다(SEO_RECOVERY_2026_09 §5 B2).
 *
 * `publisher`는 `@id` 참조만 남긴다. 홈에서 발행하는 `Organization` 노드와 같은
 * `@id`라 크롤러가 그래프를 이어 붙인다 — 여기서 이름·로고를 다시 적으면 같은
 * 조직이 사이트 안에서 두 벌로 선언된다.
 */
export function buildSymbolWebPageJsonLd({
    generatedAt,
    ...params
}: SymbolWebPageParams): Record<string, unknown> {
    return {
        ...buildWebPageJsonLd(params),
        ...(generatedAt != null && {
            dateModified: new Date(generatedAt).toISOString(),
        }),
        publisher: {
            '@type': 'Organization',
            '@id': ORGANIZATION_JSON_LD_ID,
        },
    };
}
