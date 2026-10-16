import 'server-only';
import { cache } from 'react';
import type { SqueezeRiskContext } from '@y0ngha/siglens-core';
import { isRegShoThresholdDataEnabled } from '@/shared/api/exchange/regShoThresholdDataEnabled';
import { isFinraShortDataEnabled } from '@/shared/api/finra/finraShortDataEnabled';
import { isDynamicServerError } from '@/shared/lib/isDynamicServerError';
import { toSqueezeContext } from '../lib/squeezeContext';

/** `evaluateInvestorFlows`·`runInvestorFlowsAnalysis`에 똑같이 넘기는 옵션. */
export interface InvestorFlowsEvaluationOptions {
    /** `FINRA_SHORT_DATA_ENABLED`. */
    readonly includeFinraData: boolean;
    /** `REG_SHO_THRESHOLD_DATA_ENABLED`. */
    readonly includeExchangeLists: boolean;
    /** 숏스퀴즈 점수의 가격 입력. 봉을 못 읽으면 없다 — core는 가격 없는 옛 판정으로 돌아간다. */
    readonly squeezeContext?: SqueezeRiskContext;
}

/**
 * 숏스퀴즈 가격 입력 — 마감 세션까지의 일봉(`getSessionBarsStatic`, 세션 키 24h 캐시)에서 날짜·종가·거래량만 뽑는다.
 *
 * 6h 봉 캐시(`getBarsStatic`)를 쓰지 않는 이유: 수급 탭(12h 선언)이 렌더 중 그 캐시를 읽으면 라우트 revalidate가 6h로
 * 내려간다(`symbolTabRevalidateClamp` 가드). 세션 키 캐시는 형성 중 봉이 없어 같은 세션 안에서 값이 같다 — 그래서 페이지·
 * AI 해석·에이전트 도구·종합 분석 프리웜이 같은 입력을 보고 core 캐시 키·inputHash가 맞는다.
 *
 * 수급 탭은 미국 주식 전용이라 시장 프로필은 `us-equity`로 고정한다(한국 탭은 후속 PR에서 시장을 함께 넘긴다). US 주식의
 * FMP 심볼은 티커와 같아 `fmpSymbol`을 넘기지 않는다 — 포지션 탭과 같은 캐시 엔트리를 공유한다.
 *
 * 봉 조회 실패는 수급을 막지 않는다 — `undefined`로 돌려 가격 없는 판정을 쓴다. Next 제어 흐름 오류만 다시 던진다.
 */
async function loadSqueezeContext(
    symbol: string
): Promise<SqueezeRiskContext | undefined> {
    try {
        // 지연 import: 봉 캐시 모듈은 불러오는 순간 `unstable_cache` 래퍼를 만든다(`buildDegradedRevalidate`). 이 파일은
        // 에이전트 도구·종합 분석·공개 API 라우트처럼 넓게 import되는 그래프에 들어가므로, 숏스퀴즈 입력을 실제로 읽을 때만
        // 그 모듈을 불러 무관한 import 그래프(과 그 테스트의 `next/cache` 부분 목)에 부작용을 퍼뜨리지 않는다.
        const { getSessionBarsStatic } =
            await import('@/entities/bars/lib/sessionBarsStaticCache');
        const data = await getSessionBarsStatic(symbol, 'us-equity');
        return toSqueezeContext(data.bars);
    } catch (error) {
        if (isDynamicServerError(error)) throw error;
        console.warn(
            '[investor-flows] squeeze bars unavailable, scoring without price:',
            error
        );
        return undefined;
    }
}

/**
 * 수급 점수표·AI 해석의 평가 옵션을 한 곳에서 만든다. 화면 점수(`getInvestorFlowsScorecard`)와 AI가 해석하는 점수
 * (`runInvestorFlowsAction`)가 같은 플래그·같은 숏스퀴즈 입력에서 나와야 둘이 다른 말을 하지 않는다.
 *
 * 플래그(`includeFinraData`·`includeExchangeLists`)는 스냅샷이 이미 `null`로 주더라도 함께 넘긴다 — 12시간 캐시된 옛
 * 스냅샷이 플래그 전환보다 오래 살 수 있다(core 계약). React `cache`로 한 요청 안의 중복 호출을 접는다.
 */
export const getInvestorFlowsEvaluationOptions = cache(
    async (symbol: string): Promise<InvestorFlowsEvaluationOptions> => {
        const squeezeContext = await loadSqueezeContext(symbol.toUpperCase());
        return {
            includeFinraData: isFinraShortDataEnabled(),
            includeExchangeLists: isRegShoThresholdDataEnabled(),
            ...(squeezeContext === undefined ? {} : { squeezeContext }),
        };
    }
);
