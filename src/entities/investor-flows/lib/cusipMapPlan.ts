import type { FmpProfileIdentifiers } from '@/shared/api/fmp/profileIdentifiersClient';
import { cusipFromIsin, parseProfileCusip } from './cusip';
import {
    INVESTOR_FLOWS_CUSIP_BLANKET_FAILURE_RATIO,
    INVESTOR_FLOWS_CUSIP_BLANKET_MIN_ATTEMPTS,
} from './investorFlowsPolicy';

/**
 * cusip-map이 FMP에 보내는 **HTTP 시도** 속도 상한(분당, profile 조회 + 기존 매핑 재대조 합산). FMP 플랜 한도는 분당 300건이고
 * 사이트 트래픽과 **함께** 쓴다 — 120으로 묶어 사이트 몫을 분당 180건 이상 남긴다. (운영 측정: 페이싱 전 03:00Z 실행이
 * 5분에 profile ~1,600건 ≈ 분당 320건으로 한도를 넘었다.)
 *
 * 보장: 이 실행이 FMP에 보내는 요청은 어떤 60초 구간에서도 120건 + 묶음 하나(`PROFILE_CONCURRENCY`)를 넘지 않는다. 페이서가
 * 묶음 시작마다 그 묶음의 호출 수만큼 간격을 벌리고, 호출 하나는 **HTTP 시도 하나**다 — `createDeps`가 `fmpGet`의 내부 일시 오류
 * 재시도를 끈다(`retryTransient: false`). 실패한 심볼은 이번 실행에서 다시 보내지 않고 다음 실행이 재시도한다.
 */
export const CUSIP_MAP_FMP_CALLS_PER_MINUTE = 120;
/** FMP profile 동시 호출 수 — 묶음 안에서는 동시에, 묶음 시작은 `CUSIP_MAP_FMP_CALLS_PER_MINUTE`로 벌린다. */
export const PROFILE_CONCURRENCY = 3;
/** 묶음 하나(동시 `PROFILE_CONCURRENCY`건) 뒤 다음 묶음까지의 간격 = 페이서가 한 번에 기다리는 최대 시간(1.5초). */
export const PROFILE_CHUNK_SPACING_MS =
    (PROFILE_CONCURRENCY * 60_000) / CUSIP_MAP_FMP_CALLS_PER_MINUTE;
/**
 * 한 실행이 시도하는 심볼 수 상한. 나머지는 다음 실행이 이어 간다(재개 가능). 분당 120건 페이싱에서 1,000건 ≈ 8.3분 +
 * 재대조 `INVESTOR_FLOWS_CUSIP_RECHECK_BATCH`(100건 ≈ 50초) ≈ 실행당 FMP ~1,100건이 마감 10분 안에 든다. OpenFIGI 검증까지
 * 길어지면 마감이 끊고 다음 실행이 잇는다(`cusip-map/route.ts`).
 */
export const MAX_SYMBOLS_PER_RUN = 1_000;
/**
 * 묶음의 호출이 **모두** 일시 오류(5xx·네트워크·timeout)로 실패한 묶음이 이만큼 연달아 나오면 FMP 장애로 보고 실행을 접는다
 * (`transient_outage`) — 재시도 없이 한 번씩이라도 장애 중에 1,000건을 계속 두드리지 않게. 일부만 실패한 묶음은 세지 않는다
 * (드문 단발 5xx로 부트스트랩이 끊기지 않게). 그 실행의 실패는 전면 장애와 같이 연속 실패일 수에 세지 않는다.
 */
export const CUSIP_MAP_TRANSIENT_OUTAGE_CHUNKS = 2;

/** OpenFIGI로 검증할 후보 — profile의 ISIN에서 꺼낸 CUSIP과 그 심볼. */
export interface FigiCandidate {
    symbol: string;
    cusip: string;
}

/** 매핑 하나의 키 — 같은 실행에서 방금 FMP로 만든 매핑을 재대조에서 알아보는 데 쓴다. */
export const mappingKey = (row: { cusip: string; symbol: string }): string =>
    `${row.cusip}|${row.symbol}`;

/** profile을 CUSIP 후보로 쓸 수 없을 때의 사유 — `MISS_TTL_SECONDS`의 키와 같다. */
export type ProfileMissReason = 'noProfile' | 'notCommonStock' | 'noCusip';

/** profile 하나의 판정: `fmp` = profile의 CUSIP을 그대로 쓴다, `figi` = ISIN에서 낸 CUSIP을 OpenFIGI로 검증한다, `miss` = 후보에서 뺀다. */
export type ProfileClassification =
    | { kind: 'fmp'; cusip: string }
    | { kind: 'figi'; cusip: string }
    | { kind: 'miss'; reason: ProfileMissReason };

/**
 * FMP profile에서 CUSIP을 얻는 길을 정한다. 프로필이 없거나 ETF·펀드면 보통주가 아니라 miss이고, CUSIP이 유효하면 그것을
 * 쓰며(`fmp`), 없으면 ISIN에서 낸 CUSIP을 OpenFIGI 검증 후보로 둔다(`figi`). 둘 다 없으면 miss.
 */
export function classifyProfile(
    profile: FmpProfileIdentifiers | null
): ProfileClassification {
    if (profile === null) return { kind: 'miss', reason: 'noProfile' };
    if (profile.isEtf || profile.isFund)
        return { kind: 'miss', reason: 'notCommonStock' };
    const cusip = parseProfileCusip(profile.cusip);
    if (cusip !== null) return { kind: 'fmp', cusip };
    const derived = cusipFromIsin(profile.isin);
    if (derived !== null) return { kind: 'figi', cusip: derived };
    return { kind: 'miss', reason: 'noCusip' };
}

/** 묶음의 호출이 모두 일시 오류(속도 제한 제외 — 그건 따로 접는다)로 실패했는가. */
export function isTransientOutageChunk(
    settled: readonly PromiseSettledResult<unknown>[],
    errors: {
        isRateLimitError: (error: unknown) => boolean;
        isTransientError: (error: unknown) => boolean;
    }
): boolean {
    return (
        settled.length > 0 &&
        settled.every(
            outcome =>
                outcome.status === 'rejected' &&
                !errors.isRateLimitError(outcome.reason) &&
                errors.isTransientError(outcome.reason)
        )
    );
}

/** 시도가 충분히 많고(`MIN_ATTEMPTS`) 그 거의 전부가 실패했다 — 심볼 고유 문제가 아니라 전면 장애다. */
export function isBlanketOutage(attempts: number, failures: number): boolean {
    return (
        attempts >= INVESTOR_FLOWS_CUSIP_BLANKET_MIN_ATTEMPTS &&
        failures / attempts >= INVESTOR_FLOWS_CUSIP_BLANKET_FAILURE_RATIO
    );
}
