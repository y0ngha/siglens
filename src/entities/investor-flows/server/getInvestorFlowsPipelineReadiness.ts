import 'server-only';
import { cache } from 'react';
import { isE2E } from '@/shared/api/e2eEnv';
import { isFinraShortDataEnabled } from '@/shared/api/finra/finraShortDataEnabled';
import { isRegShoThresholdDataEnabled } from '@/shared/api/exchange/regShoThresholdDataEnabled';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { SECONDS_PER_HALF_DAY } from '@/shared/config/time';
import { tryGetDatabaseClient } from '@/shared/db/client';
import { isDynamicServerError } from '@/shared/lib/isDynamicServerError';
import { DrizzleInvestorFlowsFtdRepository } from '../api/investorFlowsFtdRepository';
import { DrizzleInvestorFlowsRegShoRepository } from '../api/investorFlowsRegShoRepository';
import { DrizzleInvestorFlowsShortRepository } from '../api/investorFlowsShortRepository';
import { DrizzleInvestorFlowsUniverseRepository } from '../api/investorFlowsUniverseRepository';
import { INVESTOR_FLOWS_READINESS_TAG } from '../lib/investorFlowsTag';
import { UNKNOWN_PIPELINE_READINESS } from '../lib/investorFlowsReadiness';
import type { InvestorFlowsPipelineReadiness } from '../model';
import { isE2EFlowsPipelineCollecting } from './e2eFlowsPipeline';
import { loadInvestorFlowsPipelineReadiness } from './loadInvestorFlowsPipelineReadiness';

/** 종목 무관 캐시의 `symbol:` 태그 자리에 들어가는 센티널(`staticSymbolCache`는 키 형식을 강제하지 않는다). */
const READINESS_CACHE_SCOPE = '__INVESTOR_FLOWS_PIPELINE__';

function readE2EReadiness(): InvestorFlowsPipelineReadiness {
    const status = isE2EFlowsPipelineCollecting() ? 'collecting' : 'ready';
    return {
        institutional: status,
        short: isFinraShortDataEnabled() ? status : 'unknown',
        failsToDeliver: status,
        filings: status,
        thresholdList: isRegShoThresholdDataEnabled() ? status : 'unknown',
    };
}

function loadFromDatabase(): Promise<InvestorFlowsPipelineReadiness> {
    const client = tryGetDatabaseClient();
    if (client === null)
        throw new Error('[investor-flows] database unavailable');
    const universeRepo = new DrizzleInvestorFlowsUniverseRepository(client.db);
    const shortRepo = new DrizzleInvestorFlowsShortRepository(client.db);
    const ftdRepo = new DrizzleInvestorFlowsFtdRepository(client.db);
    const regShoRepo = new DrizzleInvestorFlowsRegShoRepository(client.db);
    return loadInvestorFlowsPipelineReadiness({
        getState: key => universeRepo.getState(key),
        hasAnyShortRow: () => shortRepo.hasAnyRow(),
        hasAnyFtdFile: () => ftdRepo.hasAnyProcessedFile(),
        // 보존 기간 안의 받은 날짜 전부 — 하나라도 있으면 된다(빈 문자열은 모든 ISO 날짜보다 작다).
        listThresholdTradeDates: () => regShoRepo.listTradeDates(''),
        isFinraEnabled: isFinraShortDataEnabled,
        isRegShoEnabled: isRegShoThresholdDataEnabled,
        now: () => new Date(),
    });
}

/**
 * 수급 탭이 "데이터 없음"과 "아직 수집 중"을 가르는 파이프라인 준비 상태(종목과 무관) — 13F·FINRA·FTD·Form 144·증자 공시·
 * 과열 목록.
 *
 * 캐시 TTL은 수급 페이지·스냅샷과 같은 12시간이다 — `[symbol]` 탭이 읽는 `unstable_cache`는 페이지 선언값보다 짧을 수 없다
 * (`symbolTabRevalidateClamp` 가드: 짧으면 라우트 revalidate가 그 값으로 내려간다). 대신 갈래마다 한 번뿐인 전환(13F 백필 완료·
 * FINRA/FTD 첫 파일·Reg SHO 첫 목록·Form 144·증자 공시 커서 따라잡음)을 만든 cron이 `INVESTOR_FLOWS_READINESS_TAG`를
 * 무효화해(`revalidateFlowsReadiness`) 안내가 12시간을 기다리지 않고 걷힌다.
 *
 * 키에 FINRA·Reg SHO 플래그를 넣는다(SERVER.md#DC-1) — 공매도·과열 목록 갈래가 플래그에 따라 달라진다. 인프라 실패(DB 오류)는 캐시 **밖**에서
 * `unknown`으로 바꾼다: 장애가 TTL 동안 캐시에 굳지 않고, 화면은 "수집 중"을 주장하지 않고 예전 동작(빈 상태)으로 돌아간다.
 * Next의 정적/ISR 제어 흐름 오류(`DYNAMIC_SERVER_USAGE`)는 인프라 실패가 아니므로 그대로 던진다.
 */
export const getInvestorFlowsPipelineReadiness = cache(
    async (): Promise<InvestorFlowsPipelineReadiness> => {
        if (isE2E()) return readE2EReadiness();
        try {
            return await staticSymbolCache<InvestorFlowsPipelineReadiness>(
                [
                    'investor-flows:pipeline-readiness-v2',
                    isFinraShortDataEnabled() ? 'finra-on' : 'finra-off',
                    isRegShoThresholdDataEnabled() ? 'regsho-on' : 'regsho-off',
                ],
                READINESS_CACHE_SCOPE,
                loadFromDatabase,
                [INVESTOR_FLOWS_READINESS_TAG],
                SECONDS_PER_HALF_DAY
            );
        } catch (error) {
            if (isDynamicServerError(error)) throw error;
            console.error(
                '[getInvestorFlowsPipelineReadiness] 상태 조회 실패, unknown:',
                error
            );
            return UNKNOWN_PIPELINE_READINESS;
        }
    }
);
