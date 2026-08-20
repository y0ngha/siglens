/**
 * 심볼 → 표시 이름.
 *
 * 지수·섹터명은 config 상수에 **한국어로만** 들어 있고(`koreanName`), 그 값은
 * core 프롬프트로도 흘러간다. 그래서 화면에서는 심볼로 카탈로그를 다시 찾는다.
 *
 * 카탈로그에 없는 심볼은 `koreanName`으로 떨어진다. 이 폴백이 없으면 config에
 * ETF 하나를 추가하는 순간 카드에 `widgets.dashboard.assetName.XLQ` 같은 **원시 키**가
 * 그대로 찍힌다 — 에러 없이, 테스트도 모른 채.
 */
export function assetLabel(
    t: { (key: string): string; has(key: string): boolean },
    symbol: string,
    fallback: string
): string {
    const key = `assetName.${symbol}`;
    return t.has(key) ? t(key) : fallback;
}
