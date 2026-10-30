import { SECONDS_PER_DAY } from '@/shared/config/time';
import { MISS_TTL_SECONDS } from '../api/cusipMissStore';
import { createCallPacer } from '../lib/callPacer';
import { CUSIP_MAP_FMP_CALLS_PER_MINUTE } from '../lib/cusipMapPlan';
import { collectCandidates } from './cusipCandidates';
import { settleMissesAndFailures } from './cusipFailureAccounting';
import { verifyWithFigi } from './cusipFigiVerify';
import { logConflicts } from './cusipMapLog';
import { syncProfiles } from './cusipProfileSync';
import { recheckExistingMappings } from './cusipRecheck';
import { markUniverseComplete } from './cusipUniverseComplete';
import type {
    SyncCusipMapDeps,
    SyncCusipMapResult,
    SyncRun,
} from './syncCusipMapTypes';

/**
 * 티커 DB의 미국 보통주 후보 중 CUSIP 매핑이 없는 종목을 채운다 — 증분·재개 가능. 단계별 구현은 형제 모듈이 맡는다.
 *
 * 1. FMP `profile`의 `cusip` → source `fmp`(`cusipProfileSync`).
 * 2. `cusip`이 없고 미국·캐나다 ISIN이 있으면 ISIN에서 CUSIP을 꺼내 후보로 두고, OpenFIGI가 그 CUSIP을
 *    **같은 티커**로 해석할 때만 source `openfigi`로 받아들인다(`cusipFigiVerify`). (OpenFIGI는 CUSIP→티커만 풀 수 있고
 *    티커→CUSIP은 못 푼다 — 그래서 "발견"이 아니라 "검증" 역할이다.)
 * 3. ETF·펀드·식별자 없음·프로필 없음은 Redis에 "최근 실패"로 표식해 다음 실행이 건너뛴다.
 * 4. 한 CUSIP을 여러 심볼이 주장하면(표기 변형·파생 상장) 하나만 쓴다(`upsertCusipMap` → `resolveCusipMapConflicts`). 버린
 *    심볼은 `duplicateCusip` miss로 표식해 후보에서 빼고, 실행 끝에 한 번 로그로 남긴다.
 *
 * FMP 호출은 `PROFILE_CONCURRENCY`씩 청크로 보내고(청크 시작은 분당 `CUSIP_MAP_FMP_CALLS_PER_MINUTE`건으로 벌린다 — 재대조와
 * 합산) 청크마다 DB에 쓴다. 속도 제한(429)이면 실행을 접는다.
 *
 * **인프라 오류(FMP 402·400·5xx·타임아웃, OpenFIGI 장애)는 즉시 표식하지 않는다.** 그 심볼은 후보로 남아 다음 실행에
 * 재시도되고, 심볼별 **연속 실패일 수**를 센다(`CusipMissStore.recordFailures`, `cusipFailureAccounting`):
 *  - 하루(UTC)에 심볼당 **최대 1번**만 센다 — 부트스트랩 중 같은 날 수동으로 연달아 돌려도 한 번이다.
 *  - 시도가 `INVESTOR_FLOWS_CUSIP_BLANKET_MIN_ATTEMPTS`(20) 이상이고 `…_FAILURE_RATIO`(90%) 이상이 실패한 실행은
 *    전면 장애라 **아무것도 세지 않는다**(FMP·OpenFIGI를 따로 판정, `blanketOutage`).
 *  - `INVESTOR_FLOWS_CUSIP_FAILURE_THRESHOLD`(3)일째 실패하면 7일짜리 miss를 걸어 후보에서 뺀다(그래야 전수 한 바퀴가
 *    끝난다). miss가 만료되면 다시 후보가 된다. 속도 제한은 세지 않는다.
 * 전수 한 바퀴 완료 표식은 실행 **시작 시점**의 후보가 0건일 때만 선다(아래).
 */
export async function runCusipMapSync(
    deps: SyncCusipMapDeps
): Promise<SyncCusipMapResult> {
    const result: SyncCusipMapResult = {
        status: 'complete',
        candidates: 0,
        fromProfile: 0,
        fromFigi: 0,
        misses: 0,
        errors: 0,
        rechecked: 0,
        cusipChanged: 0,
        duplicateCusips: 0,
        failuresMarked: 0,
        blanketOutage: false,
        universeCompleted: false,
    };

    // 1) 후보 수집 — 최근 실패 표식이 없는 것만, 상한까지.
    const candidates = await collectCandidates(deps, result);

    const run: SyncRun = {
        deps,
        result,
        // FMP 호출 속도 상한 — profile 조회(2)와 재대조(4)가 하나를 함께 쓴다.
        paceFmp: createCallPacer(CUSIP_MAP_FMP_CALLS_PER_MINUTE, {
            nowMs: () => deps.now().getTime(),
            sleep: deps.sleep,
        }),
        newMisses: [],
        figiCandidates: [],
        failedProfiles: [],
        profileAttempts: 0,
        failedFigi: [],
        mappedFromProfile: new Set(),
        conflicts: [],
    };

    // 2) FMP profile — 청크 단위, 청크마다 저장.
    await syncProfiles(run, candidates);

    // 3) OpenFIGI 검증 — ISIN에서 낸 CUSIP이 같은 티커인지.
    await verifyWithFigi(run);

    await settleMissesAndFailures(run);

    // 전수 한 바퀴 완료 표식(set-once) — 상한·마감·속도 제한 없이 끝났고 후보가 하나도 없을 때만. 이 표식이 서야
    // sec-13f가 수집을 시작한다. 한 번 서면 지우지 않는다: 이후 신규 상장·CUSIP 변경으로 후보가 다시 생겨도 게이트는
    // 그대로다(늦은 매핑은 baseline 규칙과 `investor-flows:reingest-13f`가 다룬다).
    // 후보는 이 실행 **시작 시점**에 센 값이라 실행 중의 오류는 이미 후보 안에 있다(그래서 오류 수를 따로 볼 필요가 없다).
    // 기존 매핑 재대조(아래 4)는 일부러 조건에 넣지 않는다 — 그건 유지보수이지 유니버스 완결의 일부가 아니다.
    if (result.status === 'complete' && result.candidates === 0) {
        result.universeCompleted = await markUniverseComplete(deps);
    }

    // 4) 기존 매핑 재대조 — 작은 배치로 오래된 것부터(전수 재처리 금지).
    const recheckConflicts =
        result.status === 'complete' || result.status === 'capped'
            ? await recheckExistingMappings(
                  deps,
                  result,
                  run.mappedFromProfile,
                  run.paceFmp
              )
            : [];
    result.duplicateCusips = run.conflicts.length + recheckConflicts.length;
    // 두 경로는 버린 심볼의 처리가 다르다 — 후보 쪽은 miss로 후보에서 빼고, 재대조 쪽은 옛 매핑을 그대로 지닌다(miss 없음).
    logConflicts(
        deps,
        run.conflicts,
        `dropped symbols are skipped for ${MISS_TTL_SECONDS.duplicateCusip / SECONDS_PER_DAY} days`
    );
    logConflicts(
        deps,
        recheckConflicts,
        'on CUSIP re-check — dropped symbols keep their existing mapping, no miss recorded'
    );
    return result;
}
