import 'server-only';
import {
    runAnalysis,
    type ModelId,
    type SubmitAnalysisOptions,
    type Timeframe,
} from '@y0ngha/siglens-core';
import {
    loadOverallHistoryInputs,
    loadTechnicalAnalysisInputs,
} from '@/app/api/ai/chat/tools/freshAnalysisInputs';
import { resolveAssetInfoOrNull } from '@/app/api/ai/chat/tools/resolveAssetInfo';
import type { Outcome } from '@/app/api/ai/chat/tools/runFreshAnalysis';
import { executeOverallAnalysis } from '@/entities/analysis/server/overallAnalysisRunner';
import { executeNewsAnalysis } from '@/entities/news-article/server/newsAnalysisRunner';
import { executeOptionsAnalysis } from '@/entities/options-chain/server/optionsAnalysisRunner';
import type { ApiKeyPrincipal } from '@/entities/siglens-api-key/model';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveMarketProfile';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { getDescriptor } from '@/shared/config/marketProfile/registry';
import type { Locale } from '@/shared/i18n/locales';
import {
    assertCallerRouting,
    ByokOnlyRoutingError,
    CACHE_PROBE_KEY_PLACEHOLDER,
    tierForByokOnly,
    type AnalysisCaller,
} from '@/shared/lib/byokOnly';

export interface RunnerInput {
    symbol: string;
    kind: string;
    timeframe: Timeframe;
    model: ModelId;
    locale: Locale;
    principal: ApiKeyPrincipal;
}

export interface RunArgs {
    cacheOnly: boolean;
    signal: AbortSignal;
    caller: AnalysisCaller;
}

export interface Runner {
    callerFor(input: {
        userKey: string | undefined;
        byokOnly: boolean;
        useProbePlaceholder: boolean;
    }): AnalysisCaller;
    run(args: RunArgs): Promise<Outcome>;
}

/**
 * 종류별 입력(시장 프로필·종목명·이력)을 한 번만 모아 두고, 캐시 확인과 생성이 같은 입력으로 core를 부르게 한다
 * (캐시 키가 입력에 접히므로 둘이 어긋나면 확인과 생성이 서로 다른 항목을 본다).
 */
export async function prepareRunner(input: RunnerInput): Promise<Runner> {
    const { symbol, kind, timeframe, model, locale, principal } = input;
    const coreTier = tierForByokOnly(principal.tier);
    const [profile, asset] = await Promise.all([
        resolveMarketProfile(symbol),
        resolveAssetInfoOrNull(symbol, 'run_fresh_analysis'),
    ]);
    const companyName = asset?.name ?? symbol;

    const callerFor: Runner['callerFor'] = ({
        userKey,
        byokOnly,
        useProbePlaceholder,
    }) => {
        const userApiKey = useProbePlaceholder
            ? CACHE_PROBE_KEY_PLACEHOLDER
            : userKey;
        return {
            userId: principal.userId,
            tier: coreTier,
            byokOnly,
            ...(userApiKey === undefined ? {} : { userApiKey }),
        };
    };

    // 캐시 확인과 생성이 같은 이력 입력을 보게 한다(캐시 키에 접히는 값이라 둘이 어긋나면 안 되고,
    // 같은 조회를 두 번 하지 않는다). 첫 호출 때만 읽는다.
    const technicalInputs = once(() =>
        loadTechnicalAnalysisInputs({
            symbol,
            timeframe,
            profile,
            fmpSymbol: asset?.fmpSymbol,
            userId: principal.userId,
            tier: coreTier,
            positionBucketLogTag:
                '[api/v1] run_fresh_analysis position bucket resolution failed, degrading to no-bucket:',
        })
    );
    const overallInputs = once(() =>
        loadOverallHistoryInputs({ symbol, timeframe, profile })
    );

    const run = async ({
        cacheOnly,
        caller,
        signal,
    }: RunArgs): Promise<Outcome> => {
        // 생성(LLM을 부를 수 있는) 호출은 반드시 BYOK 전용 검사를 거친다. 캐시 확인만 이 검사 없이 돈다
        // (자리표시 키·free/member 등급 모델은 `cacheOnly`에서만 허용된다).
        if (!cacheOnly && caller.byokOnly !== true)
            throw new ByokOnlyRoutingError(
                'generating call without the BYOK-only check'
            );
        switch (kind) {
            case 'technical': {
                const inputs = await technicalInputs();
                const descriptor = getDescriptor(profile);
                const options: SubmitAnalysisOptions = {
                    modelId: model,
                    marketDataProvider: getCachedMarketDataProvider(
                        inputs.session
                    ),
                    session: inputs.session,
                    assetClass: descriptor.assetClass,
                    currency: descriptor.priceFormat.currency,
                    tierContext: {
                        userId: principal.userId,
                        tier: caller.tier,
                    },
                    reasoning: false,
                    locale,
                    skipEnqueueIfMiss: cacheOnly,
                    signal,
                    // 서버 키 fallback 금지: `providerFallback`을 켜면 사용자 DeepSeek 호출이 실패할 때
                    // core가 서버 Gemini 키로 다시 시도한다. 사용자가 고른 모델이므로 쓰지 않는다.
                    priorAnalyses: inputs.priorAnalyses,
                    marketEvents: inputs.marketEvents,
                    positionBucket: inputs.positionBucket,
                    ...(caller.userApiKey === undefined
                        ? {}
                        : { userApiKey: caller.userApiKey }),
                };
                assertCallerRouting(caller, model, cacheOnly);
                return (await runAnalysis(
                    symbol,
                    companyName,
                    timeframe,
                    false,
                    asset?.fmpSymbol,
                    options
                )) as Outcome;
            }
            case 'overall': {
                const history = await overallInputs();
                return (await executeOverallAnalysis({
                    caller,
                    symbol,
                    companyName,
                    timeframe,
                    modelId: model,
                    locale,
                    signal,
                    options: {
                        reasoning: false,
                        priorAnalyses: history.overallPriorAnalyses,
                        technicalPriorAnalyses: history.technicalPriorAnalyses,
                        marketEvents: history.marketEvents,
                        cacheOnly,
                    },
                })) as Outcome;
            }
            case 'news':
                return (await executeNewsAnalysis({
                    caller,
                    symbol,
                    companyName,
                    modelId: model,
                    locale,
                    reasoning: false,
                    cacheOnly,
                    signal,
                })) as Outcome;
            case 'options':
                return (await executeOptionsAnalysis({
                    caller,
                    symbol,
                    companyName,
                    expirationDate: 'all',
                    modelId: model,
                    locale,
                    reasoning: false,
                    cacheOnly,
                    signal,
                })) as Outcome;
            default:
                throw new Error(`Unreachable run_fresh_analysis kind: ${kind}`);
        }
    };
    return { callerFor, run };
}

/** 첫 호출의 promise를 재사용한다(실패하면 다음 호출이 다시 시도하도록 캐시에서 뺀다). */
function once<T>(load: () => Promise<T>): () => Promise<T> {
    let pending: Promise<T> | null = null;
    return () => {
        pending ??= load().catch((error: unknown) => {
            pending = null;
            throw error;
        });
        return pending;
    };
}
