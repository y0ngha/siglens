import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';

/** `korean_tickers`의 상장 상태만 담은 최소 행. */
export interface KrTickerListingRow {
    symbol: string;
    /** `null`이면 상장 중. 값이 있으면 그 시점에 상폐로 표시됐다. */
    delistedAt: Date | null;
}

export interface KrTickerReconcilePlan {
    /** 이번 응답에 없어 상폐로 표시할 심볼. 가드가 걸리면 빈 배열이다. */
    delist: readonly string[];
    /**
     * 응답에서 사라진 심볼 전체 — **가드와 무관하게 항상 채운다.**
     *
     * `delist`는 가드가 걸리면 비므로, 사람이 `--force-delist`를 줄지 판단할 때 볼
     * 목록이 남지 않는다. 호출부가 이 필터를 다시 구현하면 그 순간부터 "운영자가 본
     * 목록"과 "승인 시 실제로 적용될 목록"이 어긋날 수 있다.
     */
    delistCandidates: readonly string[];
    /** 상폐로 표시돼 있었으나 다시 관측된 심볼 — 표시를 해제한다. */
    relist: readonly string[];
    /**
     * 상폐 처리를 건너뛴 사유. 정상이면 `null`.
     *
     * 가드가 걸려도 upsert와 relist는 그대로 진행한다 — 둘 다 행을 살리는 방향이라
     * 부분 응답으로 잘못 실행돼도 손실이 없다. 지우는 방향만 막는다.
     */
    guardTrip: string | null;
    /** 상폐 대상에 포함된 `POPULAR_TICKERS` 심볼 — sitemap이 404를 싣게 되므로 알림용. */
    delistedPopular: readonly string[];
}

/**
 * 응답이 이보다 적으면 무조건 상폐 처리를 건너뛴다.
 *
 * KOSPI+KOSDAQ 상장 종목은 2,500종목대다(2026-08 실측 2,595). 페이지네이션이 중간에
 * 끊기거나 API가 빈 목록을 200으로 돌려주는 흔한 실패 모드에서 이 절대 하한이 먼저 잡는다.
 *
 * 아래 소실 상한과 둘 다 필요하다: DB가 비어 있는 최초 실행에서는 사라질 종목 자체가
 * 없어 소실 상한이 아무것도 막지 못하고, 반대로 응답이 정상 크기인데 뒷부분만 잘린
 * 경우는 이 하한을 통과하므로 소실 상한이 잡는다. 이 하한은 오버라이드되지 않는다.
 */
export const KR_RECONCILE_MIN_COUNT = 1_000;

/**
 * 이 수를 **넘으면 그 회차의 상폐 처리를 통째로 건너뛴다** — 앞의 25개만 처리하는
 * 상한이 아니라 전량 중단 임계다.
 *
 * 처음에는 "수신 건수가 기존 상장 수의 90% 미만이면 건너뛴다"는 비율 가드였는데,
 * 산술이 의도를 배신했다 — 2,595종목 기준 90%는 **하루 259종목까지 조용히 통과**시킨다.
 * 실제 상폐는 하루 0~2종목이므로 두 자릿수 배로 헐거웠고, 마지막 몇 페이지만 빠지는
 * 페이지네이션 결함은 정확히 그 틈으로 지나간다.
 *
 * 사라진 종목 수를 직접 세는 쪽이 위험을 그대로 표현한다. 25는 정기 정리(관리종목 일괄
 * 상폐 등)를 흡수하면서도 부분 응답과는 확실히 구분되는 선이다. 걸리면 상폐 처리가 하루
 * 미뤄질 뿐이고 로그가 크게 남는다 — 되돌릴 수 없는 쪽으로 틀리지 않는다.
 *
 * **진짜로 25종목 넘게 상폐된 날은 크론이 스스로 수렴하지 못한다** — 다음 날도 같은
 * 후보 집합이 나와 계속 걸린다. 그건 의도된 정지다: 그 규모면 사람이 목록을 눈으로
 * 확인할 값어치가 있다. 확인 후에는 `yarn db:seed:kr-names --force-delist`로 한 번
 * 통과시킨다(재배포 불필요). 절차는 `docs/reference/CRON.md`의 kr-tickers 항목 참조.
 */
export const KR_RECONCILE_DELIST_ABORT_THRESHOLD = 25;

const POPULAR_SET = new Set<string>(POPULAR_TICKERS);

export interface KrTickerReconcileOptions {
    /**
     * 사람이 대량 상폐를 확인한 뒤 한 번 통과시키는 수동 오버라이드
     * (`yarn db:seed:kr-names --force-delist`). 절대 하한은 **여전히 적용된다** —
     * 빈 응답으로 테이블을 비우는 경로는 어떤 플래그로도 열리지 않는다.
     */
    allowLargeDelist?: boolean;
}

/**
 * 공공데이터포털 응답과 DB 현재 상태를 대조해 상장 상태 변경분을 계산한다.
 *
 * 순수 함수다 — DB도 네트워크도 건드리지 않는다. 시드 스크립트(`tsx`, Next 밖)와
 * 크론 라우트(Next 안)가 **같은 판정을 공유해야** 하는데, 스크립트는 `server-only`를
 * 거치는 앱 모듈을 import할 수 없어 각자 DB 접근 코드를 따로 갖는다. 위험한 판단
 * (무엇을 지울 것인가)은 전부 여기 있고, 양쪽에 남는 중복은 테이블 선언과 SQL 실행뿐이다.
 * 그래서 가드가 걸린 경우의 후보 목록도 호출부가 다시 계산하지 않고
 * `delistCandidates`로 받는다 — 두 벌이 되면 조용히 어긋난다.
 *
 * 행을 삭제하지 않고 표시만 하는 이유: 상폐 종목 URL로 들어온 방문자에게 한글명은
 * 여전히 필요하고, 오탐이었을 때 되돌리는 비용이 0이다.
 */
export function planKrTickerReconcile(
    fetchedSymbols: readonly string[],
    existing: readonly KrTickerListingRow[],
    options: KrTickerReconcileOptions = {}
): KrTickerReconcilePlan {
    const fetched = new Set(fetchedSymbols);
    const listedNow = existing.filter(row => row.delistedAt === null);

    const relist = existing
        .filter(row => row.delistedAt !== null && fetched.has(row.symbol))
        .map(row => row.symbol);

    const candidates = listedNow
        .filter(row => !fetched.has(row.symbol))
        .map(row => row.symbol);

    const guardTrip = checkGuards(
        fetched.size,
        candidates.length,
        options.allowLargeDelist === true
    );
    const delist = guardTrip === null ? candidates : [];

    return {
        delist,
        delistCandidates: candidates,
        relist,
        guardTrip,
        delistedPopular: delist.filter(symbol => POPULAR_SET.has(symbol)),
    };
}

/** 로그 한 줄에 담을 최대 심볼 수 — 그 이상은 개수만 덧붙인다. */
const CANDIDATE_LOG_LIMIT = 50;

/**
 * 가드가 걸렸을 때 사람이 눈으로 볼 후보 목록을 한 줄로 만든다.
 *
 * 크론과 시드 스크립트가 같은 문자열을 내야 한다 — 운영자가 CloudWatch에서 본 목록과
 * 손으로 돌렸을 때 보는 목록이 다르면 승인 판단의 근거가 흔들린다.
 */
export function formatCandidates(candidates: readonly string[]): string {
    const head = candidates.slice(0, CANDIDATE_LOG_LIMIT).join(', ');
    const overflow = candidates.length - CANDIDATE_LOG_LIMIT;
    return overflow > 0 ? `${head} … (+${overflow})` : head;
}

function checkGuards(
    fetchedCount: number,
    delistCount: number,
    allowLargeDelist: boolean
): string | null {
    if (fetchedCount < KR_RECONCILE_MIN_COUNT) {
        return `fetched ${fetchedCount} < absolute floor ${KR_RECONCILE_MIN_COUNT}`;
    }
    if (
        !allowLargeDelist &&
        delistCount > KR_RECONCILE_DELIST_ABORT_THRESHOLD
    ) {
        return `${delistCount} symbols vanished in one sync > abort threshold ${KR_RECONCILE_DELIST_ABORT_THRESHOLD} — rerun with --force-delist after eyeballing the list`;
    }
    return null;
}
