import { getTableName, type SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import {
    cusipSymbolMap,
    sec13fAggregates,
    sec13fFilings,
    sec13fOptionAggregates,
    sec13fOptionPositions,
    sec13fPositions,
} from '@/shared/db/schema';
import {
    buildAggregateDeleteSql,
    buildAggregateUpsertSql,
    buildBaselinelessAggregateUpsertSql,
    buildOptionAggregateDeleteSql,
    buildOptionAggregateUpsertSql,
    buildResetChangesSql,
} from '../../api/aggregateSql';

const dialect = new PgDialect();
const render = (query: SQL): { text: string; params: unknown[] } => {
    const { sql, params } = dialect.sqlToQuery(query);
    return { text: sql.replace(/\s+/g, ' '), params };
};

/**
 * 렌더된 SQL의 테이블 이름은 스키마에서 읽는다. 리터럴로 적으면 스키마 이름이 바뀌어도 이 테스트가
 * 낡은 이름을 고정한 채 통과한다.
 */
const TABLE = {
    aggregates: getTableName(sec13fAggregates),
    filings: getTableName(sec13fFilings),
    positions: getTableName(sec13fPositions),
    cusipMap: getTableName(cusipSymbolMap),
    optionAggregates: getTableName(sec13fOptionAggregates),
    optionPositions: getTableName(sec13fOptionPositions),
};

const COMPLETE_UPSERT_SQL = ` WITH m AS ( SELECT id, cusip, created_at FROM ${TABLE.cusipMap} WHERE cusip IN ($1, $2) ), pe AS ( SELECT min(universe_stamp) AS first_at FROM ${TABLE.filings} WHERE period = $3 AND processed_at IS NOT NULL ), j AS ( SELECT coalesce(c.cusip_id, p.cusip_id) AS cusip_id, c.shares AS cur_shares, c.value_k AS cur_value, p.shares AS prev_shares FROM ( SELECT cik, cusip_id, shares, value_k FROM ${TABLE.positions} WHERE period = $4 AND cusip_id IN (SELECT id FROM m) ) c FULL OUTER JOIN ( SELECT cik, cusip_id, shares FROM ${TABLE.positions} WHERE period = $5 AND cusip_id IN (SELECT id FROM m) ) p ON p.cik = c.cik AND p.cusip_id = c.cusip_id ) INSERT INTO ${TABLE.aggregates} AS a (cusip, period, holders, shares, value_usd, new_holders, increased, decreased, exited, net_share_change, computed_at) SELECT m.cusip, $6::date, (count(*) FILTER (WHERE j.cur_shares IS NOT NULL))::int, (coalesce(sum(j.cur_shares), 0))::bigint, (coalesce(sum(j.cur_value), 0) * 1000)::bigint, CASE WHEN m.created_at <= (SELECT first_at FROM pe) THEN (count(*) FILTER (WHERE j.cur_shares IS NOT NULL AND j.prev_shares IS NULL))::int END, CASE WHEN m.created_at <= (SELECT first_at FROM pe) THEN (count(*) FILTER (WHERE j.cur_shares > j.prev_shares))::int END, CASE WHEN m.created_at <= (SELECT first_at FROM pe) THEN (count(*) FILTER (WHERE j.cur_shares < j.prev_shares))::int END, CASE WHEN m.created_at <= (SELECT first_at FROM pe) THEN (count(*) FILTER (WHERE j.cur_shares IS NULL AND j.prev_shares IS NOT NULL))::int END, CASE WHEN m.created_at <= (SELECT first_at FROM pe) THEN (coalesce(sum(j.cur_shares), 0) - coalesce(sum(j.prev_shares), 0))::bigint END, now() FROM j JOIN m ON m.id = j.cusip_id GROUP BY m.id, m.cusip, m.created_at ON CONFLICT (cusip, period) DO UPDATE SET holders = excluded.holders, shares = excluded.shares, value_usd = excluded.value_usd, new_holders = excluded.new_holders, increased = excluded.increased, decreased = excluded.decreased, exited = excluded.exited, net_share_change = excluded.net_share_change, computed_at = now() WHERE (a.holders, a.shares, a.value_usd, a.new_holders, a.increased, a.decreased, a.exited, a.net_share_change) IS DISTINCT FROM (excluded.holders, excluded.shares, excluded.value_usd, excluded.new_holders, excluded.increased, excluded.decreased, excluded.exited, excluded.net_share_change)`;
const BASELINELESS_UPSERT_SQL = ` WITH m AS ( SELECT id, cusip FROM ${TABLE.cusipMap} WHERE cusip IN ($1) ) INSERT INTO ${TABLE.aggregates} AS a (cusip, period, holders, shares, value_usd, computed_at) SELECT m.cusip, $2::date, (count(*))::int, (coalesce(sum(p.shares), 0))::bigint, (coalesce(sum(p.value_k), 0) * 1000)::bigint, now() FROM ${TABLE.positions} p JOIN m ON m.id = p.cusip_id WHERE p.period = $3 GROUP BY m.cusip ON CONFLICT (cusip, period) DO UPDATE SET holders = excluded.holders, shares = excluded.shares, value_usd = excluded.value_usd, computed_at = now() WHERE (a.holders, a.shares, a.value_usd) IS DISTINCT FROM (excluded.holders, excluded.shares, excluded.value_usd)`;
const RESET_CHANGES_SQL = ` UPDATE ${TABLE.aggregates} SET new_holders = NULL, increased = NULL, decreased = NULL, exited = NULL, net_share_change = NULL, computed_at = now() WHERE period = $1::date AND new_holders IS NOT NULL`;

describe('buildAggregateUpsertSql', () => {
    describe('complete mode (full previous quarter vs full current quarter)', () => {
        const { text, params } = render(
            buildAggregateUpsertSql('complete', '2026-06-30', '2026-03-31', [
                '037833100',
                '594918104',
            ])
        );

        it('does not restrict either side to a filer set (symmetric populations)', () => {
            // 핀의 주목 절: `FROM ( SELECT … FROM positions WHERE period = $4 …) c FULL OUTER JOIN ( … period = $5 …) p` — 양쪽 모두 cik 제한이 없고,
            // filings는 `pe` CTE의 이전 분기 첫 적재 시각 조회에만 나온다.
            expect(text).toBe(COMPLETE_UPSERT_SQL);
        });

        it('binds period, prior period and CUSIPs as parameters (never inlined)', () => {
            expect(params).toEqual([
                '037833100',
                '594918104',
                '2026-03-31', // first-ingestion subquery (prior period)
                '2026-06-30', // current period positions
                '2026-03-31', // prior period positions
                '2026-06-30', // the period column written
            ]);
            // 핀의 주목 절: `$1`~`$6` 자리표시자만 있고 날짜·CUSIP 리터럴이 없다(위 params가 값을 가진다).
            expect(text).toBe(COMPLETE_UPSERT_SQL);
        });

        it('classifies new / increased / decreased / exited from the full outer join', () => {
            // 핀의 주목 절: `FULL OUTER JOIN` 뒤 `cur_shares IS NOT NULL AND prev_shares IS NULL`(신규), `>`(증가), `<`(감소), `IS NULL AND … IS NOT NULL`(이탈).
            expect(text).toBe(COMPLETE_UPSERT_SQL);
        });

        it('nulls every change column for a CUSIP mapped AFTER the prior period was first ingested (per-CUSIP baseline by ingestion time)', () => {
            // 핀의 주목 절: 다섯 변경 컬럼 모두 `CASE WHEN m.created_at <= (SELECT first_at FROM pe) THEN … END`로 감싸인다.
            expect(text).toBe(COMPLETE_UPSERT_SQL);
        });

        it('derives the baseline reference from the prior period’s earliest universe snapshot stamp, not from processed_at or a calendar cutoff', () => {
            // 핀의 주목 절: 기준은 `pe` CTE의 `min(universe_stamp)`(이전 분기, `processed_at IS NOT NULL` filings)이고 달력 컷오프가 아니다.
            expect(text).toBe(COMPLETE_UPSERT_SQL);
        });

        it('stores value in thousands and scales the sum back to dollars', () => {
            // 핀의 주목 절: `(coalesce(sum(j.cur_value), 0) * 1000)::bigint` — 천 단위 합을 달러로 되돌린다.
            expect(text).toBe(COMPLETE_UPSERT_SQL);
        });

        it('skips unchanged rows with an IS DISTINCT FROM guard on the conflict update', () => {
            // 핀의 주목 절: `ON CONFLICT … DO UPDATE … WHERE (a.holders, …) IS DISTINCT FROM (excluded.holders, …)`.
            expect(text).toBe(COMPLETE_UPSERT_SQL);
        });
    });

    describe('panel mode (in-progress quarter: only filers present in BOTH quarters)', () => {
        const { text } = render(
            buildAggregateUpsertSql('panel', '2026-09-30', '2026-06-30', ['A'])
        );

        it('restricts BOTH the current and the prior side to filers that filed both periods', () => {
            // 2 periods × 2 sides
            expect(text).toBe(
                ` WITH m AS ( SELECT id, cusip, created_at FROM ${TABLE.cusipMap} WHERE cusip IN ($1) ), pe AS ( SELECT min(universe_stamp) AS first_at FROM ${TABLE.filings} WHERE period = $2 AND processed_at IS NOT NULL ), j AS ( SELECT coalesce(c.cusip_id, p.cusip_id) AS cusip_id, c.shares AS cur_shares, c.value_k AS cur_value, p.shares AS prev_shares FROM ( SELECT cik, cusip_id, shares, value_k FROM ${TABLE.positions} WHERE period = $3 AND cusip_id IN (SELECT id FROM m) AND cik IN (SELECT cik FROM ${TABLE.filings} WHERE period = $4 AND processed_at IS NOT NULL) AND cik IN (SELECT cik FROM ${TABLE.filings} WHERE period = $5 AND processed_at IS NOT NULL) ) c FULL OUTER JOIN ( SELECT cik, cusip_id, shares FROM ${TABLE.positions} WHERE period = $6 AND cusip_id IN (SELECT id FROM m) AND cik IN (SELECT cik FROM ${TABLE.filings} WHERE period = $7 AND processed_at IS NOT NULL) AND cik IN (SELECT cik FROM ${TABLE.filings} WHERE period = $8 AND processed_at IS NOT NULL) ) p ON p.cik = c.cik AND p.cusip_id = c.cusip_id ) INSERT INTO ${TABLE.aggregates} AS a (cusip, period, holders, shares, value_usd, new_holders, increased, decreased, exited, net_share_change, computed_at) SELECT m.cusip, $9::date, (count(*) FILTER (WHERE j.cur_shares IS NOT NULL))::int, (coalesce(sum(j.cur_shares), 0))::bigint, (coalesce(sum(j.cur_value), 0) * 1000)::bigint, CASE WHEN m.created_at <= (SELECT first_at FROM pe) THEN (count(*) FILTER (WHERE j.cur_shares IS NOT NULL AND j.prev_shares IS NULL))::int END, CASE WHEN m.created_at <= (SELECT first_at FROM pe) THEN (count(*) FILTER (WHERE j.cur_shares > j.prev_shares))::int END, CASE WHEN m.created_at <= (SELECT first_at FROM pe) THEN (count(*) FILTER (WHERE j.cur_shares < j.prev_shares))::int END, CASE WHEN m.created_at <= (SELECT first_at FROM pe) THEN (count(*) FILTER (WHERE j.cur_shares IS NULL AND j.prev_shares IS NOT NULL))::int END, CASE WHEN m.created_at <= (SELECT first_at FROM pe) THEN (coalesce(sum(j.cur_shares), 0) - coalesce(sum(j.prev_shares), 0))::bigint END, now() FROM j JOIN m ON m.id = j.cusip_id GROUP BY m.id, m.cusip, m.created_at ON CONFLICT (cusip, period) DO UPDATE SET holders = excluded.holders, shares = excluded.shares, value_usd = excluded.value_usd, new_holders = excluded.new_holders, increased = excluded.increased, decreased = excluded.decreased, exited = excluded.exited, net_share_change = excluded.net_share_change, computed_at = now() WHERE (a.holders, a.shares, a.value_usd, a.new_holders, a.increased, a.decreased, a.exited, a.net_share_change) IS DISTINCT FROM (excluded.holders, excluded.shares, excluded.value_usd, excluded.new_holders, excluded.increased, excluded.decreased, excluded.exited, excluded.net_share_change)`
            );
        });
    });
});

describe('buildBaselinelessAggregateUpsertSql', () => {
    const { text } = render(
        buildBaselinelessAggregateUpsertSql('2026-03-31', ['A'])
    );

    it('writes only counts and never the change columns', () => {
        expect(text).toBe(BASELINELESS_UPSERT_SQL);
    });

    it('always refreshes holders / shares / value, leaving only the change columns untouched', () => {
        const update = text.slice(text.indexOf('DO UPDATE SET'));
        expect(update).toBe(
            'DO UPDATE SET holders = excluded.holders, shares = excluded.shares, value_usd = excluded.value_usd, computed_at = now() WHERE (a.holders, a.shares, a.value_usd) IS DISTINCT FROM (excluded.holders, excluded.shares, excluded.value_usd)'
        );
    });

    it('is not gated on the existing row having NULL change columns', () => {
        expect(text).toBe(BASELINELESS_UPSERT_SQL);
    });
});

describe('buildAggregateDeleteSql', () => {
    it('complete: deletes only when neither quarter has any position', () => {
        const { text, params } = render(
            buildAggregateDeleteSql('complete', '2026-09-30', '2026-06-30', [
                'A',
            ])
        );
        expect(text).toBe(
            ` DELETE FROM ${TABLE.aggregates} a WHERE a.period = $1 AND a.cusip IN ($2) AND NOT EXISTS ( SELECT 1 FROM ${TABLE.positions} p JOIN ${TABLE.cusipMap} m ON m.id = p.cusip_id WHERE m.cusip = a.cusip AND p.period IN ($3, $4) )`
        );
        expect(params).toEqual(['2026-09-30', 'A', '2026-09-30', '2026-06-30']);
    });

    it('panel: only panel filers count as "still has positions"', () => {
        const { text } = render(
            buildAggregateDeleteSql('panel', '2026-09-30', '2026-06-30', ['A'])
        );
        expect(text).toBe(
            ` DELETE FROM ${TABLE.aggregates} a WHERE a.period = $1 AND a.cusip IN ($2) AND NOT EXISTS ( SELECT 1 FROM ${TABLE.positions} p JOIN ${TABLE.cusipMap} m ON m.id = p.cusip_id WHERE m.cusip = a.cusip AND p.period IN ($3, $4) AND p.cik IN (SELECT cik FROM ${TABLE.filings} WHERE period = $5 AND processed_at IS NOT NULL) AND p.cik IN (SELECT cik FROM ${TABLE.filings} WHERE period = $6 AND processed_at IS NOT NULL) )`
        );
    });

    it('none: only rows computed without a baseline are deleted', () => {
        const { text } = render(
            buildAggregateDeleteSql('none', '2026-03-31', '2025-12-31', ['A'])
        );
        expect(text).toBe(
            ` DELETE FROM ${TABLE.aggregates} a WHERE a.period = $1 AND a.cusip IN ($2) AND a.new_holders IS NULL AND NOT EXISTS ( SELECT 1 FROM ${TABLE.positions} p JOIN ${TABLE.cusipMap} m ON m.id = p.cusip_id WHERE m.cusip = a.cusip AND p.period = $3 )`
        );
    });
});

describe('buildResetChangesSql', () => {
    it('nulls all five change columns of rows that have a baseline, for one period', () => {
        const { text, params } = render(buildResetChangesSql('2026-03-31'));
        expect(text).toBe(RESET_CHANGES_SQL);
        expect(params).toEqual(['2026-03-31']);
    });
});

describe('option aggregate SQL', () => {
    it('splits puts and calls with FILTER and binds the period and CUSIPs', () => {
        const { text, params } = render(
            buildOptionAggregateUpsertSql('2026-09-30', [
                '037833100',
                '594918104',
            ])
        );
        expect(text).toBe(
            ` INSERT INTO ${TABLE.optionAggregates} AS a (cusip, period, put_holders, put_shares, put_value_usd, call_holders, call_shares, call_value_usd, computed_at) SELECT o.cusip, $1::date, (count(*) FILTER (WHERE o.put_call = 'put'))::int, (coalesce(sum(o.shares) FILTER (WHERE o.put_call = 'put'), 0))::bigint, (coalesce(sum(o.value_usd) FILTER (WHERE o.put_call = 'put'), 0))::bigint, (count(*) FILTER (WHERE o.put_call = 'call'))::int, (coalesce(sum(o.shares) FILTER (WHERE o.put_call = 'call'), 0))::bigint, (coalesce(sum(o.value_usd) FILTER (WHERE o.put_call = 'call'), 0))::bigint, now() FROM ${TABLE.optionPositions} o WHERE o.period = $2 AND o.cusip IN ($3, $4) GROUP BY o.cusip ON CONFLICT (cusip, period) DO UPDATE SET put_holders = excluded.put_holders, put_shares = excluded.put_shares, put_value_usd = excluded.put_value_usd, call_holders = excluded.call_holders, call_shares = excluded.call_shares, call_value_usd = excluded.call_value_usd, computed_at = now() WHERE (a.put_holders, a.put_shares, a.put_value_usd, a.call_holders, a.call_shares, a.call_value_usd) IS DISTINCT FROM (excluded.put_holders, excluded.put_shares, excluded.put_value_usd, excluded.call_holders, excluded.call_shares, excluded.call_value_usd)`
        );
        expect(params).toEqual([
            '2026-09-30',
            '2026-09-30',
            '037833100',
            '594918104',
        ]);
    });

    it('deletes an aggregate only when no option position of that period is left', () => {
        const { text, params } = render(
            buildOptionAggregateDeleteSql('2026-09-30', ['A'])
        );
        expect(text).toBe(
            ` DELETE FROM ${TABLE.optionAggregates} a WHERE a.period = $1 AND a.cusip IN ($2) AND NOT EXISTS ( SELECT 1 FROM ${TABLE.optionPositions} o WHERE o.cusip = a.cusip AND o.period = $3 )`
        );
        expect(params).toEqual(['2026-09-30', 'A', '2026-09-30']);
    });
});
