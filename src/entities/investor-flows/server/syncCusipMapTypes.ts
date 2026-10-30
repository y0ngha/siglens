import type { FmpProfileIdentifiers } from '@/shared/api/fmp/profileIdentifiersClient';
import type { CusipMissStore } from '../api/cusipMissStore';
import type {
    CusipMapRow,
    CusipMapUpsertResult,
    RecheckCandidate,
} from '../api/investorFlowsUniverseRepository';
import type { CallPacer } from '../lib/callPacer';
import type { CusipConflict } from '../lib/cusipMapConflicts';
import type { FigiCandidate } from '../lib/cusipMapPlan';

/** `runCusipMapSync`가 받는 의존 전체 — FMP·OpenFIGI·DB·Redis miss 표식·시계가 모두 주입된다. */
export interface SyncCusipMapDeps {
    repo: {
        listUnmappedUsSymbols(
            afterSymbol: string,
            limit: number
        ): Promise<string[]>;
        /** CUSIP당 한 행만 쓴다 — 쓴 행과 버린 중복(`conflicts`)을 돌려준다. */
        upsertCusipMap(
            rows: readonly CusipMapRow[]
        ): Promise<CusipMapUpsertResult>;
        listRecheckCandidates(limit: number): Promise<RecheckCandidate[]>;
        markChecked(ids: readonly number[]): Promise<void>;
        /** `cusips` 중 이미 맵에 있는 것. */
        findExistingCusips(cusips: readonly string[]): Promise<Set<string>>;
        countMapped(): Promise<number>;
        getState(key: string): Promise<string | null>;
        /** 키가 없을 때만 기록한다(set-once). */
        setStateIfAbsent(key: string, value: string): Promise<void>;
    };
    now: () => Date;
    misses: CusipMissStore;
    fetchProfile: (symbol: string) => Promise<FmpProfileIdentifiers | null>;
    /** CUSIP → 티커 목록. 요청한 CUSIP 중 처리한 것만 결과에 담는다(데드라인으로 중단 가능). */
    mapCusipsToTickers: (
        cusips: readonly string[],
        shouldStop: () => boolean
    ) => Promise<Map<string, string[]>>;
    isRateLimitError: (error: unknown) => boolean;
    /** FMP 일시 오류(5xx·네트워크·timeout — `isFmpTransientError`)인가. 장애 조기 종료(`CUSIP_MAP_TRANSIENT_OUTAGE_CHUNKS`)에 쓴다. */
    isTransientError: (error: unknown) => boolean;
    isDeadlineReached: () => boolean;
    /** FMP 페이싱 대기(`createCallPacer`) — 시계는 `now`다. 테스트는 가짜 시계를 미는 함수를 넣는다. */
    sleep: (ms: number) => Promise<void>;
    log: (message: string, detail?: unknown) => void;
}

/** 한 실행의 집계 — cron 응답과 로그가 그대로 싣는다. */
export interface SyncCusipMapResult {
    status:
        | 'complete'
        | 'capped'
        | 'deadline'
        | 'rate_limited'
        /** 연달아 모두 일시 오류로 실패한 묶음(`CUSIP_MAP_TRANSIENT_OUTAGE_CHUNKS`) — FMP 장애로 보고 접었다. */
        | 'transient_outage';
    candidates: number;
    fromProfile: number;
    fromFigi: number;
    misses: number;
    errors: number;
    /** 기존 매핑을 FMP와 다시 대조한 수 / 그중 CUSIP이 바뀌어 새 행을 만든 수. */
    rechecked: number;
    cusipChanged: number;
    /** 한 CUSIP을 여러 심볼이 주장해 하나만 남긴 CUSIP 수(`resolveCusipMapConflicts`). */
    duplicateCusips: number;
    /** 이번 실행에서 연속 실패 임계에 닿아 `persistentError` miss가 걸린 심볼 수. */
    failuresMarked: number;
    /** 시도의 거의 전부가 실패해(전면 장애) 이번 실행의 실패를 세지 않았는가. */
    blanketOutage: boolean;
    /** 이 실행이 "전수 한 바퀴 완료" 표식을 **처음** 세웠는가(이미 서 있었으면 false). */
    universeCompleted: boolean;
}

/** 실행 하나의 가변 진행 기록 — 단계(후보 수집 → profile → OpenFIGI → miss·실패 정산 → 재대조)가 제자리에서 채운다. */
export interface SyncRun {
    deps: SyncCusipMapDeps;
    result: SyncCusipMapResult;
    /** FMP 호출 속도 상한 — profile 조회와 재대조가 하나를 함께 쓴다. */
    paceFmp: CallPacer;
    newMisses: { symbol: string; ttlSeconds: number }[];
    figiCandidates: FigiCandidate[];
    /** 인프라 오류로 이번에 못 얻은 심볼 — 연속 실패를 세어 임계에 닿으면 miss로 후보에서 뺀다. */
    failedProfiles: string[];
    profileAttempts: number;
    failedFigi: string[];
    /** 이번 실행이 FMP profile로 만든 매핑(`mappingKey`) — 재대조가 같은 profile을 다시 받지 않게 한다. */
    mappedFromProfile: Set<string>;
    /** 후보 쓰기에서 한 CUSIP을 여러 심볼이 주장해 버린 건 — 실행 끝에 한 번 로그로 남긴다. */
    conflicts: CusipConflict[];
}
