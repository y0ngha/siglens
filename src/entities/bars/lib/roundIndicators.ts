import type { IndicatorResult } from '@y0ngha/siglens-core';

/**
 * 클라이언트로 내려보내는 지표값의 **유효숫자** 자릿수.
 *
 * 지표 계산은 IEEE-754 double로 이뤄져 `78.09897109260167` 같은 17자리 값이 그대로
 * 직렬화된다. 차트는 이 값을 픽셀로 그리므로 유효숫자 6자리 아래는 렌더 결과를 바꾸지
 * 못한다.
 *
 * **고정 소수 자릿수(예: `round(v, 4)`)를 쓰지 않는 이유** — 그 방식은 값의 크기를
 * 무시해서 저가 자산을 통째로 0으로 만든다:
 * - SHIBUSD처럼 $0.0001 미만인 크립토가 지원 목록에 있고
 *   (`shared/config/popular-cryptos.ts`), 그래서 crypto 프로필은 이미
 *   `precision: { kind: 'dynamic-by-magnitude' }`로 선언돼 있다
 *   (`shared/config/marketProfile/crypto.ts`). 가격 기반 지표(ma·ema·bollinger·
 *   atr·supertrend·ichimoku·volumeProfile 등)가 전부 0이 되어 차트가 평평해진다.
 * - `macd[].histogram`은 부호로 모멘텀 라벨이 갈리는데(`views/symbol/utils/
 *   technicalFacts.ts`의 `> 0` / `< 0` 분기), 0 교차 구간의 미세값이 0으로 뭉개지면
 *   '상승'/'하락'이 '중립'으로 뒤집힌다. 이 텍스트는 SSR로도 나가고 AI 프롬프트에도 쓰인다.
 *
 * 유효숫자 방식은 크기에 비례해 자릿수를 잡으므로 두 경우 모두 보존된다
 * (실측: `0.0000123456789` → `1.23457e-5`, `0.00003` → `3e-5`).
 *
 * 6자리로 정한 근거(2026-08-13 `/AAPL` 실측 페이로드, indicators 768,296 chars 기준):
 * 5자리 -36.8%, **6자리 -34.0%**(506,706 chars), 7자리 -30.8%. 고정 4자리(-34.0%)와
 * 절감이 같으면서 위 두 결함이 없다 — 결함 제거에 페이로드 비용이 들지 않았다.
 * 가격 기준으로도 6자리면 `178.123`까지 남아 1픽셀보다 촘촘하다.
 */
export const INDICATOR_SIGNIFICANT_DIGITS = 6;

/**
 * 정수와 비유한값은 그대로 둔다.
 *
 * 정수(거래량·OBV 등)를 유효숫자로 깎으면 `1234567890` → `1.23457e9`처럼 **값 자체가
 * 달라진다** — 자릿수 절감 목적과 무관하게 데이터를 훼손하므로 제외한다.
 * `NaN`/`Infinity`는 `toPrecision`이 문자열로 뱉어 `Number()` 왕복 시 의미가 흔들릴 수
 * 있어 그대로 통과시킨다.
 */
function roundNumber(value: number): number {
    if (!Number.isFinite(value) || Number.isInteger(value)) return value;
    return Number(value.toPrecision(INDICATOR_SIGNIFICANT_DIGITS));
}

/**
 * 임의 깊이의 지표 구조를 순회하며 실수만 축소한다.
 *
 * `IndicatorResult`는 필드마다 모양이 다르다 — 평면 배열(`rsi`), 객체 배열(`macd`),
 * Record-of-arrays(`ma`/`ema`), 스냅샷 객체(`smc`/`volumeProfile`). 필드명을 열거하는
 * 대신 값의 형태로 재귀하므로, core가 지표를 추가해도 자동으로 적용된다
 * (`quantizeBars.ts`의 key-generic 순회와 같은 전략).
 */
function roundDeep(value: unknown): unknown {
    if (typeof value === 'number') return roundNumber(value);
    if (Array.isArray(value)) return value.map(roundDeep);
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([k, v]) => [
                k,
                roundDeep(v),
            ])
        );
    }
    return value;
}

/**
 * 지표 페이로드를 클라이언트 직렬화 경계에서 축소한다.
 *
 * 2026-08-13 실측: `/AAPL` RSC 페이로드 888KB 중 `indicators`가 768KB(86.5%)였고,
 * 그 안의 숫자 29,664개 중 85.6%가 8자 초과 full-precision float였다. 유효숫자 6자리로
 * 줄이면 indicators가 506,706 chars가 되어(-34.0%) 전체 페이로드가 약 29% 감소한다.
 * 숫자 개수는 29,664개 그대로 — 필드·원소 손실 없이 표현만 짧아진다.
 *
 * 심볼 라우트는 롱테일(URL당 1.14회 요청, 93%가 1회성)이라 CDN 캐시가 사실상 도움을
 * 주지 못하는 구간이다 — 즉 이 페이로드는 매 요청 오리진에서 그대로 나간다. 게다가
 * `useBars`가 30초 staleTime으로 장중 재요청하므로 사용자당 반복 비용이기도 하다.
 * 배경: docs/architecture/CDN_CACHING.md §2 (L5)
 *
 * **계산과 캐시는 건드리지 않는다.** core의 지표 계산도, 캐시 키도 그대로다 —
 * 값을 만들어 캐시에 넣는 과정은 불변이고, 클라이언트로 나가는 마지막 순간에만 줄인다.
 */
export function roundIndicators(indicators: IndicatorResult): IndicatorResult {
    // safe: roundDeep은 키를 보존하고 실수만 같은 자리의 실수로 바꾸므로
    // 런타임 모양이 IndicatorResult와 구조적으로 동일하다.
    return roundDeep(indicators) as IndicatorResult;
}
