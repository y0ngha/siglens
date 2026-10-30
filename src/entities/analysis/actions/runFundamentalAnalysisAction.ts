'use server';

import {
    runFundamentalAnalysis,
    type SubmitFundamentalAnalysisOptions,
    type RunFundamentalAnalysisResult,
} from '@y0ngha/siglens-core';
import { getFundamentalDataProvider } from '@/shared/api/fmp/getFundamentalDataProvider';
import { currencyForSymbol } from '@/shared/config/marketProfile/registry';
import type { Locale } from '@/shared/i18n/locales';
import type { AnalysisGateBlockedResult } from '@/shared/lib/types';
import { fetchQuotePriceForAnalysis } from '../server/fetchQuotePriceForAnalysis';
import { runGatedAnalysis } from '../server/runGatedAnalysis';

/** core의 펀더멘털 분석 결과에 siglens 쪽 게이트 거부를 더한 최종 반환 타입. */
export type RunFundamentalAnalysisActionResult =
    | RunFundamentalAnalysisResult
    | AnalysisGateBlockedResult;

/**
 * Server Action: tier·BYOK 게이트를 거쳐 FMP provider로 siglens-core 펀더멘털 분석을
 * 제출한다. `cached | submitted | error`를 돌려준다. 게이트·E2E 단락·catch-all은
 * `runGatedAnalysis`가 맡는다.
 */
export async function runFundamentalAnalysisAction(
    symbol: string,
    modelId: SubmitFundamentalAnalysisOptions['modelId'],
    /**
     * 요청 로케일. 게이트 거부 문구가 사용자에게 그대로 보이는데
     * `/api/*`는 next-intl matcher 밖이라 액션이 스스로 알 수 없다.
     * **기본값을 두지 않는다** — 두면 호출부에서 빠져도 타입체커가 못 잡는다
     * (실측: `resolveRequestLocale`을 상수로 바꿔도 10,516개 테스트가 초록이었다).
     */
    locale: Locale,
    /** 클라이언트가 요청한 "깊은 생각" 토글. 회원·pro tier에서만 반영된다. */
    reasoning?: boolean,
    signal?: AbortSignal,
    /**
     * 캐시만 읽고 미스면 생성하지 않는다(`miss_no_trigger`). 큐레이션 밖 종목에서
     * 첫 신뢰 입력 전에 클라이언트가 보낸다(`useAiAutoRunAllowed`).
     */
    cacheOnly?: boolean
): Promise<RunFundamentalAnalysisActionResult> {
    return runGatedAnalysis({
        actionName: 'runFundamentalAnalysisAction',
        cacheOnly,
        modelId,
        locale,
        reasoning,
        e2eResult: async () => {
            const { e2eCachedFundamental } =
                await import('@/shared/api/e2eAnalysisStub');
            return e2eCachedFundamental();
        },
        submit: gated =>
            runFundamentalAnalysis({
                symbol,
                // 화면 로케일을 AI 산출물 언어로 그대로 넘긴다 — core 0.53.0부터
                // 받는다. `ko`는 접미 없는 기존 캐시 키를 그대로 맞힌다.
                locale,
                modelId,
                dataProvider: getFundamentalDataProvider(symbol),
                // `## Derived Metrics`의 price-relative 행(target upside 등)이
                // 계산되도록 시세를 넘긴다 — core는 자체 quote provider가 없다.
                // 캐시 키에는 포함되지 않는다(시점 값). 지연 getter(core의
                // `currentPrice?: number | null | (() => Promise<number | null>)`)
                // — core는 캐시 미스 **뒤에만** 호출하므로 캐시 적중은 이 시세 조회
                // 비용을 내지 않는다. 조회 실패는 분석 자체를 막지 않는다
                // (`fetchQuotePriceForAnalysis`가 `undefined`로 감싼다 → `null`).
                currentPrice: () =>
                    fetchQuotePriceForAnalysis(symbol).then(
                        price => price ?? null
                    ),
                // 시가총액·목표주가의 상장 통화. core는 심볼에서 추론하지 않는다.
                currency: currencyForSymbol(symbol),
                signal,
                ...gated,
            }),
    });
}
