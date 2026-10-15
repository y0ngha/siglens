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
    ByokOnlyRoutingError,
    resolveCallerKeyOptions,
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
    /** 공개 API 호출자는 항상 BYOK 전용이다. 키가 없으면(캐시 확인) `userKey`를 비운다. */
    callerFor(userKey: string | undefined): AnalysisCaller;
    run(args: RunArgs): Promise<Outcome>;
}

/**
 * 종류별 입력(시장 프로필·종목명·이력)을 한 번만 모아 두고, 캐시 확인과 생성이 같은 입력으로 core를 부르게 한다
 * (캐시 키가 입력에 접히므로 둘이 어긋나면 확인과 생성이 서로 다른 항목을 본다).
 */
export async function prepareRunner(input: RunnerInput): Promise<Runner> {
    const { symbol, kind, timeframe, model, locale, principal } = input;
    const [profile, asset] = await Promise.all([
        resolveMarketProfile(symbol),
        resolveAssetInfoOrNull(symbol, 'run_fresh_analysis'),
    ]);
    const companyName = asset?.name ?? symbol;

    // tier는 호출자의 실제 값이다. BYOK 전용에서는 core가 tier로 키를 고르지 않으므로(서버 키를 읽지
    // 않는다) tier는 타임프레임 접근·정보 깊이에만 쓰인다.
    const callerFor: Runner['callerFor'] = userKey => ({
        userId: principal.userId,
        tier: principal.tier,
        byokOnly: true,
        ...(userKey === undefined ? {} : { userApiKey: userKey }),
    });

    // 캐시 확인과 생성이 같은 이력 입력을 보게 한다(캐시 키에 접히는 값이라 둘이 어긋나면 안 되고,
    // 같은 조회를 두 번 하지 않는다). 첫 호출 때만 읽는다.
    const technicalInputs = once(() =>
        loadTechnicalAnalysisInputs({
            symbol,
            timeframe,
            profile,
            fmpSymbol: asset?.fmpSymbol,
            userId: principal.userId,
            tier: principal.tier,
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
        // 공개 API 호출은 언제나 BYOK 전용이다. 생성(LLM을 부를 수 있는) 호출이 그 표시 없이 오면
        // `keyPolicy: 'byok-only'`가 core에 가지 않아 서버 키 경로가 열리므로 core를 부르기 전에 거절한다.
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
                    // 서버 키 fallback 금지: `providerFallback`을 켜지 않는다(`keyPolicy: 'byok-only'`도 core에서
                    // 이를 끈다). 사용자가 고른 모델이므로 실패는 그대로 드러나야 한다.
                    priorAnalyses: inputs.priorAnalyses,
                    marketEvents: inputs.marketEvents,
                    positionBucket: inputs.positionBucket,
                    ...resolveCallerKeyOptions(caller, cacheOnly),
                };
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
