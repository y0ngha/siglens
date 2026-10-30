import { BENCHMARK_PUBLISHED } from '@/shared/config/benchmark';
import { assertBenchmarkRelease } from './lib/assertBenchmarkRelease';
import type { BenchmarkRelease } from './types';
import release202610 from './data/release-2026-10.json';

/**
 * 화면이 읽는 유일한 진입점. 게이트가 꺼져 있으면 데이터가 있어도 `null`이다 — 라우트·
 * about 요약·푸터가 한 값으로 열리고 닫히게 한다.
 */
export function getPublishedBenchmarkRelease(): BenchmarkRelease | null {
    return BENCHMARK_PUBLISHED ? BENCHMARK_RELEASE : null;
}

/**
 * 공개 중인 벤치마크 결과. `null`이면 공개 전이다 — 두 `/benchmark` 라우트는 404, about
 * 요약·푸터 링크·ai sitemap 항목은 없다. 게이트의 정본은 `shared/config/benchmark.ts`의
 * `BENCHMARK_PUBLISHED`이고 둘이 어긋나지 않음은 `release.test.ts`가 고정한다.
 *
 * 값은 `export.py`가 만든 `data/release-<round>.json`을 `assertBenchmarkRelease`로 검증한
 * 것이다. 새 회차는 import를 바꾸고, 내릴 때는 `null`로 두고 `BENCHMARK_PUBLISHED`를 함께
 * 내린다. JSON을 이 파일 밖에서 재export하지 않는다(barrel 금지).
 */
export const BENCHMARK_RELEASE: BenchmarkRelease | null =
    assertBenchmarkRelease(release202610);
