/**
 * 백필 시간 창 파싱 — **별도 모듈인 것이 계약이다.**
 *
 * `backfillContentLocale.ts`는 모듈 최상위에서 `main()`을 실행하는 실행
 * 스크립트다. 테스트가 거기서 `parseSince`를 import하면 그 부작용이 같이
 * 돌아 `process.exit(1)`이 터진다(pre-commit의 `test:related`가 잡았다).
 * 순수 함수는 여기 두고 양쪽이 import한다.
 */

/**
 * 기본 백필 창 — **읽기 경로와 같은 6개월**(`NEWS_LIST_PERIOD_KEY = 'last6Months'`).
 *
 * 창이 없으면 `news` 41만 행 × 3필드 = **122만 행**을 넣는데, 그중 화면에
 * 나오는 것은 6개월치뿐이다(실측: 전체 1,224,882행 vs 6개월 855,643행,
 * 1개월 70,388행). 번역까지 가면 로케일 수만큼 곱해진다 — 6개월 기준
 * 257만 행이라 AI 번역 비용이 성립하지 않는다.
 *
 * 그래서 창을 **명시적 인자**로 두고 기본값을 읽기 경로에 맞춘다. 더 좁히려면
 * `--since 1m`, 전부 넣으려면 `--since all`.
 */
export const DEFAULT_SINCE = '6 months';

/**
 * `--since` 값을 Postgres `interval` 리터럴로 바꾼다.
 *
 * 사용자 입력을 SQL에 그대로 끼우므로 **형태를 좁게 검증한다** — 이 스크립트는
 * 운영 DB를 대상으로 돌 수 있다.
 */
export function parseSince(raw: string | null): string | null {
    if (raw === null) return DEFAULT_SINCE;
    if (raw === 'all') return null;
    const m = /^(\d{1,4})(d|w|m|y)$/.exec(raw);
    if (m === null) {
        throw new Error(
            `[backfill] --since 형식이 잘못됐다: ${raw} (예: 30d, 4w, 6m, 1y, all)`
        );
    }
    const unit = { d: 'days', w: 'weeks', m: 'months', y: 'years' }[m[2]!]!;
    return `${m[1]} ${unit}`;
}
