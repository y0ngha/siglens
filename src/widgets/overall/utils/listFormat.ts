/**
 * `Intl.ListFormat` 생성은 싸지 않다(로케일 데이터 조회 + 규칙 컴파일). 렌더마다 새로
 * 만들면 그 비용이 매 렌더에 붙으므로 로케일 수(4개)만큼만 모듈 수준에서 캐시한다.
 */
const LIST_FORMAT_CACHE = new Map<string, Intl.ListFormat>();

function listFormatFor(intlLocale: string): Intl.ListFormat {
    const cached = LIST_FORMAT_CACHE.get(intlLocale);
    if (cached) return cached;
    const created = new Intl.ListFormat(intlLocale, {
        style: 'long',
        type: 'conjunction',
    });
    LIST_FORMAT_CACHE.set(intlLocale, created);
    return created;
}

/** 항목을 로케일의 접속 규칙으로 잇는다(ko `A, B 및 C`, ja/zh는 `、`). */
export function formatConjunction(
    intlLocale: string,
    items: readonly string[]
): string {
    return listFormatFor(intlLocale).format(items);
}
