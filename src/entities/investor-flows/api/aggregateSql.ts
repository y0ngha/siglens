import 'server-only';
import { sql, type SQL } from 'drizzle-orm';

/**
 * (cusip, period) 집계 재계산 SQL — 설계 §2 "이번 분기 vs 직전 분기 포지션 비교".
 *
 * 테이블·컬럼 이름은 리터럴로 쓴다(`schema.ts`와 일치는 테스트가 고정한다). 모든 값은 바인드 파라미터다.
 * `cusips`는 청크(≤ `INVESTOR_FLOWS_UPSERT_CHUNK_SIZE`)로 잘라 넘길 것 — 배열은 `IN ($1, …)` 목록으로 펼쳐진다.
 * 포지션은 `cusip_id`(map의 대리키)로 저장되므로 CTE `m`이 CUSIP 문자열 ↔ id를 잇는다. 포지션의 `value_k`는
 * **천 달러**라 집계 `value_usd`는 `× 1000`이다.
 *
 * ── 비교 정의(core의 항등식 `priorHolders = holders − newHolders + exited`,
 *    `priorShares = shares − netShareChange`가 성립하도록 **양쪽을 대칭**으로 잡는다) ─────────────────────
 *
 *  - `complete`(제출 마감이 지난 분기): **직전 분기 전체**와 **이번 분기 전체**를 비교한다. 필러 필터가 없다.
 *    이번 분기에 새로 낸 필러의 보유는 신규(new), 더는 안 낸 필러의 직전 보유는 청산(exited)으로 센다 — 필러
 *    이탈·진입(churn)이 new/exited에 섞이는 것이 맞고, 양쪽이 같은 모집단이라 대칭이다. 그래서
 *    `prior = 직전 분기 집계의 holders/shares` 그대로다.
 *  - `panel`(진행 중 분기): **직전·이번 두 분기에 모두 13F를 낸 필러(패널)**만 양쪽에서 본다. 이번에 낸 필러만
 *    남기고 직전 쪽만 거르면 직전 분기 전체와 다른 모집단이 되어 편향된다. holders/shares/value도 패널
 *    기준이다(진행 중 분기는 core가 채점하지 않는 부분 집계). 항등식은 패널 모집단에 대해 성립한다.
 *
 *  - new: 직전에 없던 보유 / increased·decreased: 양쪽에 있고 수량이 늘었/줄었다 /
 *    exited: 직전엔 있었고 이번엔 없다 / net_share_change: 이번 합계 − 직전 합계(같은 모집단).
 *  - **CUSIP별 baseline**은 **제출이 파싱된 유니버스** 기준이다. 제출은 파싱 시점의 `cusip_symbol_map` 스냅샷으로 걸러지고
 *    (그때 맵에 없던 CUSIP의 행은 그 제출에서 버려진다), 그 스냅샷 시각(DB 시계)을 원장 `sec_13f_filings.universe_stamp`에
 *    적어 둔다. CUSIP은 **직전 분기의 가장 이른 파싱 스냅샷에 이미 들어 있었을 때**(`created_at <= min(universe_stamp)`,
 *    `created_at`도 DB 시계) 직전 분기 보유가 모두 수집됐다고 본다. 그보다 늦게 매핑된 CUSIP은 직전 분기가 불완전하다 —
 *    변화 열은 NULL이다(holders/shares/value는 채운다). 스탬프가 없으면(처리된 제출이 없음) 비교가 NULL이라 역시 NULL이다.
 *    분기 단위 필러 수 규칙(`INVESTOR_FLOWS_BASELINE_MIN_FILERS`) 위에 얹힌다.
 *    (처리 시각 `processed_at`이 아니라 스냅샷 스탬프를 쓰는 이유: 제출을 파싱하는 동안 — 다운로드는 길다 — 새로 매핑된
 *    CUSIP은 이미 걸러진 뒤인데 `processed_at`은 그 매핑 **뒤**라서, 처리 시각 규칙은 이런 겹침을 baseline 있음으로 오판한다.
 *    cusip-map이 전수 한 바퀴를 끝내기 전에는 sec-13f가 돌지 않으므로 정상 순서에서는 모든 백필 분기가 baseline을 갖는다.)
 *
 * 변경이 없는 행은 `IS DISTINCT FROM` 가드로 UPDATE를 건너뛴다(재계산이 같은 값을 쓰는 흔한 경우).
 */
export type AggregateMode = 'complete' | 'panel' | 'none';

/** 양쪽 분기에 모두 반영된 필러만 — `panel` 모드의 필러 필터. */
function panelFilter(period: string, prevPeriod: string): SQL {
    return sql`
          AND cik IN (SELECT cik FROM sec_13f_filings WHERE period = ${period} AND processed_at IS NOT NULL)
          AND cik IN (SELECT cik FROM sec_13f_filings WHERE period = ${prevPeriod} AND processed_at IS NOT NULL)`;
}

export function buildAggregateUpsertSql(
    mode: 'complete' | 'panel',
    period: string,
    prevPeriod: string,
    cusips: readonly string[]
): SQL {
    const filter = mode === 'panel' ? panelFilter(period, prevPeriod) : sql``;
    return sql`
WITH m AS (
    SELECT id, cusip, created_at FROM cusip_symbol_map WHERE cusip IN ${cusips}
), pe AS (
    SELECT min(universe_stamp) AS first_at FROM sec_13f_filings
    WHERE period = ${prevPeriod} AND processed_at IS NOT NULL
), j AS (
    SELECT
        coalesce(c.cusip_id, p.cusip_id) AS cusip_id,
        c.shares AS cur_shares,
        c.value_k AS cur_value,
        p.shares AS prev_shares
    FROM (
        SELECT cik, cusip_id, shares, value_k
        FROM sec_13f_positions
        WHERE period = ${period} AND cusip_id IN (SELECT id FROM m)${filter}
    ) c
    FULL OUTER JOIN (
        SELECT cik, cusip_id, shares
        FROM sec_13f_positions
        WHERE period = ${prevPeriod} AND cusip_id IN (SELECT id FROM m)${filter}
    ) p ON p.cik = c.cik AND p.cusip_id = c.cusip_id
)
INSERT INTO sec_13f_aggregates AS a
    (cusip, period, holders, shares, value_usd, new_holders, increased, decreased, exited, net_share_change, computed_at)
SELECT
    m.cusip,
    ${period}::date,
    (count(*) FILTER (WHERE j.cur_shares IS NOT NULL))::int,
    (coalesce(sum(j.cur_shares), 0))::bigint,
    (coalesce(sum(j.cur_value), 0) * 1000)::bigint,
    CASE WHEN m.created_at <= (SELECT first_at FROM pe) THEN (count(*) FILTER (WHERE j.cur_shares IS NOT NULL AND j.prev_shares IS NULL))::int END,
    CASE WHEN m.created_at <= (SELECT first_at FROM pe) THEN (count(*) FILTER (WHERE j.cur_shares > j.prev_shares))::int END,
    CASE WHEN m.created_at <= (SELECT first_at FROM pe) THEN (count(*) FILTER (WHERE j.cur_shares < j.prev_shares))::int END,
    CASE WHEN m.created_at <= (SELECT first_at FROM pe) THEN (count(*) FILTER (WHERE j.cur_shares IS NULL AND j.prev_shares IS NOT NULL))::int END,
    CASE WHEN m.created_at <= (SELECT first_at FROM pe) THEN (coalesce(sum(j.cur_shares), 0) - coalesce(sum(j.prev_shares), 0))::bigint END,
    now()
FROM j JOIN m ON m.id = j.cusip_id
GROUP BY m.id, m.cusip, m.created_at
ON CONFLICT (cusip, period) DO UPDATE SET
    holders = excluded.holders,
    shares = excluded.shares,
    value_usd = excluded.value_usd,
    new_holders = excluded.new_holders,
    increased = excluded.increased,
    decreased = excluded.decreased,
    exited = excluded.exited,
    net_share_change = excluded.net_share_change,
    computed_at = now()
WHERE (a.holders, a.shares, a.value_usd, a.new_holders, a.increased, a.decreased, a.exited, a.net_share_change)
    IS DISTINCT FROM
    (excluded.holders, excluded.shares, excluded.value_usd, excluded.new_holders, excluded.increased, excluded.decreased, excluded.exited, excluded.net_share_change)`;
}

/**
 * 이전 분기 기준이 없을 때(분기 필러 수가 부족하거나 직전 분기 포지션이 이미 정리된 분기)의 재계산. 보유 기관 수·수량·가치는
 * **항상** 갱신하고 변화 열은 **건드리지 않는다** — 새 행이면 NULL로 남는다(비교할 것이 없는데 0이나 "전부 신규"로 적으면
 * 거짓 신호). 이미 기준이 있던 시절의 변화 열이 남아 있다면 `resetAggregateChanges`(`rebuild --reset`)로 비운다.
 */
export function buildBaselinelessAggregateUpsertSql(
    period: string,
    cusips: readonly string[]
): SQL {
    return sql`
WITH m AS (
    SELECT id, cusip FROM cusip_symbol_map WHERE cusip IN ${cusips}
)
INSERT INTO sec_13f_aggregates AS a (cusip, period, holders, shares, value_usd, computed_at)
SELECT
    m.cusip,
    ${period}::date,
    (count(*))::int,
    (coalesce(sum(p.shares), 0))::bigint,
    (coalesce(sum(p.value_k), 0) * 1000)::bigint,
    now()
FROM sec_13f_positions p JOIN m ON m.id = p.cusip_id
WHERE p.period = ${period}
GROUP BY m.cusip
ON CONFLICT (cusip, period) DO UPDATE SET
    holders = excluded.holders,
    shares = excluded.shares,
    value_usd = excluded.value_usd,
    computed_at = now()
WHERE (a.holders, a.shares, a.value_usd) IS DISTINCT FROM (excluded.holders, excluded.shares, excluded.value_usd)`;
}

/**
 * 재계산 대상인데 모드가 보는 포지션이 하나도 없어진 종목(재제출로 마지막 보유자가 사라진 경우)의 집계 행을
 * 지운다. `complete`는 이번·직전 분기 전체, `panel`은 패널 필러만, `none`은 이번 분기가 비고 행이 기준 없이
 * 계산된 것(`new_holders IS NULL`)일 때만 지운다.
 */
export function buildAggregateDeleteSql(
    mode: AggregateMode,
    period: string,
    prevPeriod: string,
    cusips: readonly string[]
): SQL {
    if (mode === 'none') {
        return sql`
DELETE FROM sec_13f_aggregates a
WHERE a.period = ${period} AND a.cusip IN ${cusips} AND a.new_holders IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM sec_13f_positions p JOIN cusip_symbol_map m ON m.id = p.cusip_id
      WHERE m.cusip = a.cusip AND p.period = ${period}
  )`;
    }
    const filter =
        mode === 'panel'
            ? sql`
      AND p.cik IN (SELECT cik FROM sec_13f_filings WHERE period = ${period} AND processed_at IS NOT NULL)
      AND p.cik IN (SELECT cik FROM sec_13f_filings WHERE period = ${prevPeriod} AND processed_at IS NOT NULL)`
            : sql``;
    return sql`
DELETE FROM sec_13f_aggregates a
WHERE a.period = ${period} AND a.cusip IN ${cusips}
  AND NOT EXISTS (
      SELECT 1 FROM sec_13f_positions p JOIN cusip_symbol_map m ON m.id = p.cusip_id
      WHERE m.cusip = a.cusip AND p.period IN (${period}, ${prevPeriod})${filter}
  )`;
}

/** 기준 규칙이 엄격해졌을 때 한 분기의 변화 열을 NULL로 되돌린다(`rebuild --reset`). */
export function buildResetChangesSql(period: string): SQL {
    return sql`
UPDATE sec_13f_aggregates
SET new_holders = NULL, increased = NULL, decreased = NULL, exited = NULL, net_share_change = NULL, computed_at = now()
WHERE period = ${period}::date AND new_holders IS NOT NULL`;
}
