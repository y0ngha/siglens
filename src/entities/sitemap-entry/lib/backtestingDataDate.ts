import { deriveBacktestStats } from '@/entities/backtest-case';
import type { BacktestCase } from '@y0ngha/siglens-core';

/**
 * `/backtesting` sitemap 엔트리의 lastmod — 정적 데이터셋의 마지막 진입일.
 *
 * 이 페이지의 본문은 `src/app/[locale]/backtesting/data.json` 고정 산출물이라
 * 배포로 바뀌지 않는다. 릴리스 시각(`SITE_BUILD_DATE`)을 lastmod로 쓰면 배포마다
 * "방금 바뀜"을 주장하게 되고, 부정확한 lastmod는 Google이 그 sitemap의 lastmod를
 * 통째로 무시하게 만든다(2026-09-17 감사).
 *
 * 파싱할 수 없으면 `undefined`를 돌려 빌더가 기존 폴백을 쓰게 한다 — sitemap이
 * `Invalid Date`를 내보내는 것보다 덜 정확한 값이 낫다.
 */
export function backtestingDataDate(
    cases: readonly BacktestCase[]
): Date | undefined {
    const { periodEnd } = deriveBacktestStats(cases);
    if (periodEnd === '') return undefined;
    const parsed = new Date(`${periodEnd}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
