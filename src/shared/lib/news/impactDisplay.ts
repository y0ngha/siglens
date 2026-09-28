import type { NewsImpact } from '@y0ngha/siglens-core';

/**
 * 뉴스 가격 영향(`NewsImpact`) 배지 표시 테이블 — `sentimentDisplay.ts`의 짝.
 * 종목 뉴스(`widgets/news/sections/NewsList`)와 시장 뉴스
 * (`widgets/market-news/MarketNewsCard`)가 함께 쓴다. 예전에는 두 위젯이 각자
 * 사본을 갖고 있었고 색이 어긋났다(NewsList만 `text-secondary-400` — AA 미달).
 *
 * 라벨 **키**만 담는다 — `t()`는 소비 컴포넌트에서 부른다.
 *
 * 예전에는 이 테이블이 두 벌 있었고(`market-news`는 `주가 영향`,
 * `news`는 `가격 영향`), 둘 다 한국어 리터럴이라 네 로케일 전부 한국어였다.
 * 문구는 자산 중립 쪽(`가격`)으로 통일한다 — 크립토 페이지에서 `주가`는
 * 틀린 말이다.
 */
export const IMPACT_LABEL_KEY: Record<NewsImpact, string> = {
    high: 'newsImpact.high',
    medium: 'newsImpact.medium',
    low: 'newsImpact.low',
    negligible: 'newsImpact.negligible',
};

export const IMPACT_CLASS: Record<NewsImpact, string> = {
    high: 'bg-ui-warning/10 text-ui-warning-text',
    medium: 'bg-primary-500/10 text-primary-400',
    low: 'bg-secondary-700 text-secondary-300',
    negligible: 'bg-secondary-700/50 text-secondary-300',
};

/**
 * Type guard for {@link NewsImpact}. Uses {@link IMPACT_CLASS}
 * (Record<NewsImpact, string>) as the exhaustiveness source — if core adds a
 * new impact level, the IMPACT_CLASS definition fails to compile, preventing
 * silent drift.
 */
export function isNewsImpact(value: unknown): value is NewsImpact {
    // `in`은 프로토타입까지 본다(`'toString' in {}` → true) — 자기 키만 인정한다.
    return typeof value === 'string' && Object.hasOwn(IMPACT_CLASS, value);
}
