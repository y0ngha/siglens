/**
 * 벤치마크 결과 공개 게이트. 의존성이 없다 — 엣지 런타임(`proxy.ts`)과 위젯(Footer)이
 * 같은 값을 읽기 때문이다(`aiHost.ts`와 같은 이유).
 *
 * 공개 PR이 `entities/benchmark/release.ts`의 `BENCHMARK_RELEASE`를 채울 때 이 값을
 * `true`로 함께 바꾼다. 둘이 어긋나면 라우트는 열리는데 데이터가 없거나(404), 데이터는
 * 있는데 링크·sitemap이 없는 상태가 되므로 `entities/benchmark/__tests__/release.test.ts`가
 * `BENCHMARK_PUBLISHED === (BENCHMARK_RELEASE !== null)`을 고정한다.
 */
export const BENCHMARK_PUBLISHED: boolean = false;

/** 사이트 경로(로케일 접두사 없음). */
export const BENCHMARK_PATH = '/benchmark';

/**
 * 공개 데이터(문항·정답·답변 원문·채점·심사)의 라이선스 — CC BY 4.0(2026-10-23 사용자 결정).
 * 출처만 밝히면 재사용·재분석·재배포할 수 있어 외부 검증과 인용에 맞다. 하네스 코드는 레포 전체와
 * 같은 MIT다(`LICENSE`).
 */
export const BENCHMARK_DATA_LICENSE_URL =
    'https://creativecommons.org/licenses/by/4.0/';
