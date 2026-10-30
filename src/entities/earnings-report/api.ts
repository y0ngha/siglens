import type { EarningsCalendarItem } from '@y0ngha/siglens-core';
import type { SiglensDatabase } from '@/shared/db/types';
import { getFundamentalDataProvider } from '@/shared/api/fmp/getFundamentalDataProvider';
import { MS_PER_DAY } from '@/shared/config/time';
import { kstDateKey } from '@/shared/lib/etTimeUtils';
import { isEarningsReportStale } from './lib/isEarningsReportStale';
import type { NextEarningsSchedule } from './model';
import {
    isEarningsKnownEmpty,
    markEarningsEmpty,
} from './server/earningsEmptyMarker';
import { DrizzleEarningsReportsRepository } from './server/earningsReportsRepository';

/**
 * FMP/yahoo 실적 행 조회 개수(최신순, 예정 1~2행 포함). 5 → 12(2026-10-22, dev 결함 A12):
 * 에이전트 `get_fundamentals`가 최근 8회 실적 반응을 내려면 DB에 지난 8회 발표일이 있어야
 * 하는데, 5행 창으로는 과거 3~4회만 들어왔다. 같은 엔드포인트·같은 호출 횟수(심볼당 24h 1회)에
 * 행 수만 늘어난다.
 */
export const EARNINGS_REPORT_FMP_LIMIT = 12;

/**
 * `symbol`의 다음 예정 실적 일정을, DB에 데이터가 없거나 마지막 fetch가 24시간을 넘었으면
 * FMP에서 갱신한 뒤 돌려준다. 뉴스 페이지 방문과 무관하게 도는 분석 액션이 쓴다.
 *
 * DB·FMP·`Date.now()` side effect를 포함하는 use-case이므로 순수 함수 전용 레이어
 * (lib/)가 아니라 api.ts(server-only)에 둔다. staleness 판정은 순수 함수
 * `isEarningsReportStale`(lib/)에 위임하고, `Date.now()`는 여기(I/O 경계)에서 주입한다.
 *
 * I/O 보호는 의도적으로 비대칭이다: FMP refresh만 best-effort(try-catch로 삼켜 분석이
 * earnings 없이 진행)이고, DB I/O(getLatestFetchedAt/getNextForSymbol) 오류는 호출자
 * (Server Action)의 try-catch에 위임한다.
 */
export async function getNextEarningsReport(
    symbol: string,
    db: SiglensDatabase
): Promise<EarningsCalendarItem | null> {
    const repo = new DrizzleEarningsReportsRepository(db);
    const today = await refreshEarningsIfStale(repo, symbol);
    return repo.getNextForSymbol(symbol, today);
}

/**
 * {@link getNextEarningsReport}와 같은 갱신 뒤, 확정 여부(`dateConfirmed`)까지 붙여 읽는다.
 * 에이전트 도구(`get_fundamentals`)용 — 분석 경로는 core 모양 그대로인 위 함수를 쓴다.
 */
export async function getNextEarningsSchedule(
    symbol: string,
    db: SiglensDatabase
): Promise<NextEarningsSchedule | null> {
    const repo = new DrizzleEarningsReportsRepository(db);
    const today = await refreshEarningsIfStale(repo, symbol);
    return repo.getNextScheduleForSymbol(symbol, today);
}

/**
 * 24h 신선도 게이트를 넘었으면 프로바이더에서 다시 받아 upsert하고 옛 예정일을 정리한다.
 * 갱신은 best-effort(실패를 삼킨다). 조회 기준일(KST 오늘)을 돌려준다.
 */
async function refreshEarningsIfStale(
    repo: DrizzleEarningsReportsRepository,
    symbol: string
): Promise<string> {
    const today = kstDateKey(new Date());
    const fetchedAt = await repo.getLatestFetchedAt(symbol);

    if (
        isEarningsReportStale(fetchedAt, Date.now()) &&
        !(await isEarningsKnownEmpty(symbol))
    ) {
        try {
            const client = getFundamentalDataProvider(symbol);
            const reports = await client.getEarningsReports(
                symbol,
                EARNINGS_REPORT_FMP_LIMIT
            );
            await repo.upsertMany(reports);
            await repo.pruneSupersededUpcoming(symbol, reports, today);
            // FMP가 빈 응답(데이터 없는 심볼)을 주면 TTL 동안 재호출을 막는다(#567).
            if (reports.length === 0) await markEarningsEmpty(symbol);
        } catch (err) {
            // Best-effort: FMP 실패 시 분석은 실적 맥락 없이 진행한다.
            // 로깅은 남겨 운영자가 FMP 키 만료/타임아웃 등 장애를 감지할 수 있게 한다.
            console.warn('[getNextEarningsReport] FMP refresh failed:', err);
        }
    }

    return today;
}

/** 분석에 넘길 실적 발표일 조회 범위 — 최근 2년이면 눌림 해석 윈도우에 충분하다. */
export const EARNINGS_DATES_LOOKBACK_DAYS = 730;

/**
 * 분석 프롬프트·눌림 caveat에 넘길 이 회사의 실적 발표일(`YYYY-MM-DD`, 최근 2년 + 예정)을
 * DB에서 읽는다. 갱신(FMP)은 하지 않는다 — 이미 `getNextEarningsReport`를 부르는 호출자가
 * 그 뒤에 이어 붙이는 용도다.
 *
 * core는 `undefined`·`[]`를 "캘린더 모름"(안전 쪽)으로 취급한다. 행이 없으면(크립토·KR 등
 * 실적 소스가 없는 심볼) 또는 DB가 실패하면 `undefined`를 돌려주고 던지지 않는다 — 이 값
 * 때문에 분석이 실패해선 안 된다.
 *
 * 이 값은 분석 캐시 키에 접히지 않는다. 모든 경로가 같은 DB 테이블을 읽고(프리웜·종합 경로만
 * 읽기 전에 갱신한다), 그래서 방금 나온 실적 발표가 캐시된 본문에는 TTL까지 늦게 반영될 수
 * 있어도 실적이 아닌 것을 회사의 실적으로 표기하는 경로는 없다.
 */
export async function listEarningsDates(
    symbol: string,
    db: SiglensDatabase
): Promise<readonly string[] | undefined> {
    try {
        const from = new Date(
            Date.now() - EARNINGS_DATES_LOOKBACK_DAYS * MS_PER_DAY
        );
        const dates = await new DrizzleEarningsReportsRepository(
            db
        ).listDatesSince(symbol, kstDateKey(from));
        return dates.length > 0 ? dates : undefined;
    } catch (err) {
        console.warn('[listEarningsDates] lookup failed:', err);
        return undefined;
    }
}

/**
 * 최근 2년(`EARNINGS_DATES_LOOKBACK_DAYS`) 안에 **실제로 발표된** 실적일(`YYYY-MM-DD`, 오름차순).
 * {@link listEarningsDates}와 달리 예정일·실적치 없는 옛 행을 빼므로 "지난 실적 때 주가가 어떻게
 * 움직였나"의 기준일로 쓸 수 있다. DB 오류는 호출자에게 던진다(호출자가 degrade를 정한다).
 */
export async function listReportedEarningsDates(
    symbol: string,
    db: SiglensDatabase
): Promise<string[]> {
    const from = new Date(
        Date.now() - EARNINGS_DATES_LOOKBACK_DAYS * MS_PER_DAY
    );
    return new DrizzleEarningsReportsRepository(db).listReportedDatesSince(
        symbol,
        kstDateKey(from)
    );
}

/**
 * `getNextEarningsReport`(신선도 판정·FMP 갱신·빈 응답 마커 재사용 → 새 Redis 호출 없음)로
 * DB를 최신으로 만든 뒤 {@link listEarningsDates}로 읽는다. 어떤 단계가 실패해도 던지지 않고
 * `undefined`를 돌려준다.
 */
export async function resolveEarningsDates(
    symbol: string,
    db: SiglensDatabase
): Promise<readonly string[] | undefined> {
    try {
        await getNextEarningsReport(symbol, db);
    } catch (err) {
        console.warn('[resolveEarningsDates] refresh failed:', err);
    }
    return listEarningsDates(symbol, db);
}

/**
 * 이미 시작한 갱신(`getNextEarningsReport` promise)이 끝난 뒤 {@link listEarningsDates}로
 * 읽는다. 갱신을 또 돌리면 FMP 호출이 겹치므로 호출자가 쥔 promise를 재사용한다. 갱신이
 * 거부돼도(그 오류는 호출자가 자기 `Promise.all`에서 다룬다) 여기서는 던지지 않고
 * `undefined`("캘린더 모름")로 끝낸다.
 */
export function listEarningsDatesAfterRefresh(
    refresh: Promise<unknown>,
    symbol: string,
    db: SiglensDatabase
): Promise<readonly string[] | undefined> {
    return refresh.then(
        () => listEarningsDates(symbol, db),
        () => undefined
    );
}
