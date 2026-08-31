/**
 * 평이화 프롬프트에 넘길 사실 블록을 응답 객체에서 뽑는다.
 *
 * `numbers`는 응답 전체를 walk해 모은 숫자다. 두 가지 역할을 겸한다.
 *  1. 모델이 사용해도 되는 숫자의 화이트리스트
 *  2. `guardPlainText`의 숫자 판정 기준(정답지)
 *
 * `trend`·`riskLevel`은 응답 타입에 따라 없다(`news`·`congress` 등). 타입별 분기가
 * 아니라 존재 검사 하나로 처리한다 — 이 레이어는 7종 분석에 공통으로 쓰이므로
 * 특정 타입의 필드를 전제하면 안 된다.
 */
export interface PlainFacts {
    readonly symbol: string;
    /**
     * 가격에 붙일 통화 표기(`'달러'`·`'원'`).
     *
     * **없으면 모델이 맨 숫자를 그대로 쓴다.** 원본 분석문이 `MA20 421.46`처럼
     * 지표명 뒤에 단위 없는 숫자를 쓰는데, 지표명을 지우라고 하면 숫자만 남는다
     * (실측: technical 8.9개/건, overall 8.0개/건이 단위 없는 맨 숫자였다).
     * `319.70달러`처럼 원본 산문에 단위가 있던 값만 우연히 살아남았다.
     */
    readonly currency?: string;
    readonly trend?: string;
    readonly riskLevel?: string;
    readonly numbers: readonly number[];
}

/** 중첩 객체·배열을 훑어 유한 숫자를 전부 모은다. */
export function collectNumbers(
    value: unknown,
    out: Set<number> = new Set()
): Set<number> {
    if (typeof value === 'number') {
        if (Number.isFinite(value)) out.add(value);
        return out;
    }
    if (Array.isArray(value)) {
        for (const item of value) collectNumbers(item, out);
        return out;
    }
    if (typeof value === 'object' && value !== null) {
        for (const item of Object.values(value)) collectNumbers(item, out);
    }
    return out;
}

/**
 * 통화 코드 → 프롬프트에 실을 표기.
 *
 * 화면 문구가 아니라 모델에게 보내는 값이라 i18n 카탈로그를 거치지 않는다
 * (`analysis-plain/lib/`은 추출 제외 대상 — `scripts/i18n/lib/scan.mjs`).
 *
 * **로케일별로 갈린다.** 예전에는 `'달러'`/`'원'` 한 벌뿐이라, 프롬프트가
 * "일본어로 쓰세요"와 "facts.currency의 단위를 붙이세요"를 동시에 요구하면서
 * `319.70달러`라는 일본어 문장을 만들었다. 캐시 키에 로케일이 들어가므로 그
 * 산출물이 30일간 굳는다 — 자가 치유되지 않는 종류의 결함이다(감사 실측).
 */
const CURRENCY_LABEL: Record<string, Record<CurrencyCode, string>> = {
    ko: { USD: '달러', KRW: '원' },
    en: { USD: 'dollars', KRW: 'Korean won' },
    ja: { USD: 'ドル', KRW: 'ウォン' },
    zh: { USD: '美元', KRW: '韩元' },
};

export type CurrencyCode = 'USD' | 'KRW';

export function collectFacts(
    analysis: unknown,
    symbol: string,
    currency?: CurrencyCode,
    /** 출력 언어. 통화 표기를 그 언어로 고른다. 모르는 값은 한국어로 떨어진다. */
    locale = 'ko'
): PlainFacts {
    const record =
        typeof analysis === 'object' && analysis !== null
            ? (analysis as Record<string, unknown>)
            : {};
    return {
        symbol,
        ...(currency !== undefined
            ? {
                  currency: (CURRENCY_LABEL[locale] ?? CURRENCY_LABEL.ko)[
                      currency
                  ],
              }
            : {}),
        ...(typeof record.trend === 'string' ? { trend: record.trend } : {}),
        ...(typeof record.riskLevel === 'string'
            ? { riskLevel: record.riskLevel }
            : {}),
        numbers: [...collectNumbers(analysis)].sort((a, b) => a - b),
    };
}
