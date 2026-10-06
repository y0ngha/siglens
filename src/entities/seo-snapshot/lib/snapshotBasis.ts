import {
    MS_PER_DAY,
    MS_PER_HOUR,
    MS_PER_MINUTE,
    MS_PER_SECOND,
    SETTLE_BUFFER_MINUTES,
} from '@/shared/config/time';
import { prewarmSessionSpecFor } from './applicability';
import { snapshotCloseBoundaryFor } from './freshness';

const CRYPTO_SETTLE_BUFFER_MS = SETTLE_BUFFER_MINUTES * MS_PER_MINUTE;

/** 크립토 판정 — `isSnapshotBasisStale` JSDoc의 크립토 항목 참고. */
function isCryptoBasisStale(
    barTimeMs: number,
    analyzedAtMs: number | null,
    boundaryMs: number
): boolean {
    const dayStartMs = boundaryMs - CRYPTO_SETTLE_BUFFER_MS;
    if (barTimeMs >= dayStartMs) return false;
    const usedLastCompletedBar = barTimeMs >= dayStartMs - MS_PER_DAY;
    const analyzedAfterItCompleted =
        analyzedAtMs !== null && analyzedAtMs >= dayStartMs;
    return !(usedLastCompletedBar && analyzedAfterItCompleted);
}

/**
 * 스냅샷 `content`(jsonb)가 **어느 데이터 시점의 글인지** 읽는다.
 *
 * `seo_analysis_snapshots.generatedAt`은 "프리웜이 이 행을 쓴 시각"일 뿐이다. harvest가
 * 캐시에 있던 옛 분석(`status:'cached'`)을 그대로 집어 올리면 행은 오늘 생성된 것처럼
 * 보이는데 글은 며칠 전 가격으로 쓰여 있다 — 그래서 기준 시각은 `content` 안에서 따로
 * 읽는다(스키마 변경 없음).
 *
 * 읽는 필드 두 개:
 *  - `dataAsOf: { barTime, close }` — core가 `AnalysisResponse`에 싣는 필드(분석에 쓴 마지막
 *    봉의 시작 epoch **초**와 그 종가). core 릴리스 이전에 만들어진 결과에는 없다.
 *  - `analyzedAt` — 분석이 실행된 시각(ISO). 캐시된 옛 결과는 원래 실행 시각을 간직한다.
 *
 * 설치된 core 타입에 `dataAsOf`가 없을 수 있어(core 릴리스 순서와 무관하게 배포 가능해야
 * 한다) 타입 단언 없이 `unknown`을 좁혀 읽는다. 어느 필드가 없어도 던지지 않는다.
 */
export interface SnapshotBasis {
    /** 분석에 쓴 마지막 봉의 시작 시각(ms). 없으면 null. */
    readonly barTimeMs: number | null;
    /** 분석 실행 시각(ms). 없으면 null. */
    readonly analyzedAtMs: number | null;
    /** 글의 기준 가격(`dataAsOf.close`, 없으면 `planCheck.currentPrice`). 없으면 null. */
    readonly close: number | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null
        ? (value as Record<string, unknown>)
        : null;
}

function positiveFinite(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
        ? value
        : null;
}

function parseInstantMs(value: unknown): number | null {
    if (typeof value !== 'string') return null;
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? null : ms;
}

export function readSnapshotBasis(content: unknown): SnapshotBasis {
    const root = asRecord(content);
    if (root === null) {
        return { barTimeMs: null, analyzedAtMs: null, close: null };
    }
    const dataAsOf = asRecord(root.dataAsOf);
    const barTimeSec = positiveFinite(dataAsOf?.barTime);
    const planCheck = asRecord(root.planCheck);
    return {
        barTimeMs: barTimeSec === null ? null : barTimeSec * MS_PER_SECOND,
        analyzedAtMs: parseInstantMs(root.analyzedAt),
        close:
            positiveFinite(dataAsOf?.close) ??
            positiveFinite(planCheck?.currentPrice),
    };
}

/**
 * 주식: 봉 시작 시각이 마감 경계보다 **최대 얼마나 앞설 수 있는가**.
 *
 * 마지막 완료 세션의 봉은 시작이 그 세션 마감보다 이르다(세션 당일 자정 근처 — 경계 대비 약
 * 16~21.5시간 앞). 반면 **한 세션 이전** 봉은 거기서 다시 24시간 이상 더 앞선다(주말·휴장은 더).
 * 25시간이면 두 경우를 가른다.
 */
const EQUITY_BAR_START_TOLERANCE_MS = 25 * MS_PER_HOUR;

/**
 * 이 기준이 **직전 완료 세션보다 오래됐는가**.
 *
 * `barTime`(분석에 쓴 마지막 봉의 시작)이 있으면 **그것만** 본다 — 분석 실행 시각은 "언제
 * 돌렸는가"일 뿐 "어느 데이터였는가"가 아니기 때문이다. 없으면(옛 캐시 결과) `analyzedAt`이
 * 마감 경계보다 앞서는지 본다.
 *
 *  - 주식: 봉 시작이 마감 경계보다 25시간 넘게 앞서면 stale(직전 세션 봉이 아니다).
 *  - 크립토: 경계는 `오늘 00:00Z + 30분`이고 core의 분석 캐시는 버퍼 없이 00:00Z에 만료된다.
 *    "오늘"의 시작(경계 − 30분)을 기준으로 둘 중 하나면 현재다.
 *    여기서 "오늘 00:00Z"는 **현재 신선도 경계가 속한 날의 시작**(= 경계 − 30분)이지 달력상
 *    오늘이 아니다. 경계가 롤하기 전(00:00~00:30Z)에는 경계가 아직 전날 00:30Z이므로 이 값도
 *    전날 00:00Z다 — 의도된 동작이다. 신선도는 그 경계 기준으로 판정하고, 00:30Z에 경계가
 *    롤하면 스냅샷은 새 기준으로 다시 판정된다.
 *    - 오늘 형성 중인 일봉을 썼다(봉 시작 ≥ 오늘 00:00Z). 00:00~00:30Z 사이에 만든 분석이
 *      여기에 해당한다 — `analyzedAt`이 경계보다 이르지만 최신 글이다.
 *    - **어제 일봉**을 썼고 분석이 오늘 00:00Z 이후에 실행됐다. 그 봉이 이미 완료된 뒤의 분석이라
 *      페이지 상단 "최근 종가"(완료 일봉)와 같은 가격을 말한다. FMP는 자정 직후 한동안 오늘 봉을
 *      내지 않으므로, 이걸 stale로 보면 크립토 전 종목이 매일 강제 재생성되고도 여전히 stale로
 *      남는다(2026-10-06 운영 로그 29/29).
 *    어제 봉이라도 분석이 어제 실행됐으면(장중 가격) stale이다. 봉 시작만으로는 둘을 가를 수
 *    없어 실행 시각을 함께 본다.
 *
 * 어느 쪽 신호도 없으면 판단 근거가 없으므로 stale이 아니다 — 모르는 것을 매 tick 재생성하면
 * 비용만 든다.
 */
export function isSnapshotBasisStale(
    symbol: string,
    basis: SnapshotBasis,
    now: Date
): boolean {
    const boundaryMs = snapshotCloseBoundaryFor(symbol, now).getTime();
    if (basis.barTimeMs !== null) {
        if (prewarmSessionSpecFor(symbol).kind === 'always-open') {
            return isCryptoBasisStale(
                basis.barTimeMs,
                basis.analyzedAtMs,
                boundaryMs
            );
        }
        return basis.barTimeMs < boundaryMs - EQUITY_BAR_START_TOLERANCE_MS;
    }
    return basis.analyzedAtMs !== null && basis.analyzedAtMs < boundaryMs;
}
