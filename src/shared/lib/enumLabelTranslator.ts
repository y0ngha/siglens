/**
 * `next-intl`의 `useTranslations('shared.enumLabel')`/`getTranslations({ namespace:
 * 'shared.enumLabel' })` 반환값과 구조적으로 호환되는 최소 형태.
 *
 * `SeoTranslator`(`@/shared/lib/seo`)와 동일한 이유로 이 타입만 선언해 받는다 —
 * enum 라벨을 텍스트로 조립하는 순수 함수(fearGreedLabels.ts/sentimentDisplay.ts/
 * buildExpertAnalysisReport.ts 등)가 번역 SDK를 직접 import하지 않아도 되게 한다
 * (CLAUDE.md "pure logic 모듈에 외부 라이브러리 금지").
 *
 * **기본값을 두지 않는다.** 기본값을 두면 호출부가 조용히 `t`를 누락해도 컴파일이
 * 통과하고, 그 결과 라벨이 `trend.bullish` 같은 raw 카탈로그 키 문자열로 렌더된다.
 * 필수 파라미터로 두면 컴파일러가 모든 호출부를 강제로 나열해 준다.
 */
export type EnumLabelTranslator = (
    key: string,
    values?: Record<string, string | number>
) => string;
