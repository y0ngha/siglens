import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';

/**
 * 타임프레임 라벨을 `Intl`에서 파생한다 — 카탈로그 항목을 두지 않는다.
 *
 * 예전에는 `{'5Min': '5분', …}` 테이블이 **두 곳**(`TimeframeSelector`,
 * `dashboard-tickers`)에 복제돼 있어서 차트 선택기가 네 로케일 전부 한국어로
 * 나갔다. `Intl.NumberFormat`의 unit 스타일이 정확히 이 값을 만들고,
 * ko 출력은 기존 문자열과 문자 단위로 같다(`5분`·`1시간`·`1일`).
 *
 * 번역 카탈로그에 넣지 않는 이유: 여섯 개 라벨을 네 로케일에 손으로 유지하면
 * 새 타임프레임이 생길 때마다 번역 누락이 생기고, `Intl`은 이미 CLDR 데이터로
 * 그걸 보장한다. 용어집·복수형 규칙도 따라온다.
 */
const UNIT: Record<string, { unit: string; value: number }> = {
    '5Min': { unit: 'minute', value: 5 },
    '15Min': { unit: 'minute', value: 15 },
    '30Min': { unit: 'minute', value: 30 },
    '1Hour': { unit: 'hour', value: 1 },
    '4Hour': { unit: 'hour', value: 4 },
    '1Day': { unit: 'day', value: 1 },
};

const CACHE = new Map<string, string>();

export function timeframeLabel(timeframe: string, locale: Locale): string {
    const cacheKey = `${locale}:${timeframe}`;
    const cached = CACHE.get(cacheKey);
    if (cached !== undefined) return cached;

    const spec = UNIT[timeframe];
    // 모르는 타임프레임은 원문 그대로 — 빈 문자열보다 낫고, 새 값이 추가돼도
    // 화면이 비지 않는다.
    if (spec === undefined) return timeframe;

    const label = new Intl.NumberFormat(INTL_LOCALE[locale], {
        style: 'unit',
        unit: spec.unit,
        unitDisplay: 'short',
    }).format(spec.value);
    CACHE.set(cacheKey, label);
    return label;
}
