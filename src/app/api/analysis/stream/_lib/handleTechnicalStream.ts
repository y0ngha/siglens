import type { AssembledPromptRecord } from '@y0ngha/siglens-core';
import { tryAcquireReanalyzeCooldown } from '@/entities/analysis/lib/reanalyzeCooldown';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { resolveHoldingPositionBucket } from '@/entities/portfolio/server/resolveHoldingPositionBucket';
import { resolveKrxTickTable } from '@/entities/ticker/lib/resolveKrxTickTable';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveMarketProfile';
import { isE2E } from '@/shared/api/e2eEnv';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { getDescriptor } from '@/shared/config/marketProfile/registry';
import {
    resolveReasoning,
    resolveTierAndByok,
    resolveTierOnly,
    type ByokOutcome,
} from '@/shared/lib/byokGate';
import { localeFromRequestHeader } from '@/shared/lib/localeFromRequestHeader';
import { canAcceptAnalysisStream } from '@/shared/lib/sse/activeStreams';
import {
    createGenerationGateSlot,
    createGuestResolver,
    promptAssembledProbe,
    releaseGenerationGate,
    settleGenerationGate,
    shouldAttemptReanalyze,
    type GenerationGateSlot,
} from '../generationQuota';
import { resolveMeterGate } from '../meteredRevealGate';
import { attachModelFallback, resolveRequestModel } from '../modelFallback';
import { runAnalysis, type SubmitAnalysisOptions } from '../runAnalysisBridge';
import { e2eTechnicalResponse } from './e2eTechnicalResponse';
import {
    DEFAULT_TECHNICAL_MODEL_ID,
    schedulePersistAnalysisHistory,
} from './persistAnalysisHistory';
import { withReaderViews } from './readerViews';
import { releaseCooldownQuietly } from './releaseCooldown';
import {
    busyResponse,
    gateDeniedResponse,
    sseResponse,
    streamMessages,
    unexpectedErrorResponse,
} from './streamResponses';
import { loadTechnicalPromptInputs } from './technicalPromptInputs';
import { toClientWork } from './toClientWork';
import type { TechnicalParams } from './types';
import { withDeadline } from './withDeadline';

/** 하루 무료 공개 미터의 신규 기록 해제 함수를 바깥 catch까지 들고 가는 칸. */
interface MeterReleaseHolder {
    current: () => Promise<void>;
}

/**
 * `technical` 종류의 SSE 응답을 만든다. 다른 종류와 달리 다단계 게이팅(tier·BYOK·생성 한도·공개 미터)과
 * 보유 포지션 개인화가 붙어 `DISPATCH` 표 대신 전용 핸들러가 맡는다.
 *
 * 한도 예약과 미터 기록은 try 안에서 하지만, 예기치 못한 예외(아래 catch)에서도 되돌릴 수 있게 칸을 바깥에
 * 둔다. 환불·해제는 멱등이라 정산 경로와 겹쳐도 두 번 빼지 않는다.
 */
export async function handleTechnicalStream(
    request: Request,
    params: TechnicalParams
): Promise<Response> {
    const quotaSlot = createGenerationGateSlot();
    const meterRelease: MeterReleaseHolder = { current: async () => {} };
    try {
        return await streamTechnical(request, params, quotaSlot, meterRelease);
    } catch (err) {
        console.error('[streamAnalysisRoute] unexpected error:', err);
        await quotaSlot.release();
        await meterRelease.current();
        return unexpectedErrorResponse(localeFromRequestHeader(request));
    }
}

async function streamTechnical(
    request: Request,
    params: TechnicalParams,
    quotaSlot: GenerationGateSlot,
    meterRelease: MeterReleaseHolder
): Promise<Response> {
    const {
        symbol,
        companyName,
        timeframe,
        fmpSymbol,
        modelId: requestedModelId,
        reasoning,
        reanalyze,
        cacheOnly,
    } = params;

    // 번역자는 핸들러 진입부에서 한 번만 확보한다 — E2E 분기부터 마지막 스트림까지 모든 스트림 호출이
    // 로케일별 제네릭 문구를 필요로 하고, 동시성 검사와 스트림 생성 사이에 `await`가 들어가면 원자성이
    // 깨지기 때문이다. 번역자 로드와 인증은 서로 독립이라 함께 기다려 첫 바이트 전의 직렬 await를 줄인다.
    const requestLocale = localeFromRequestHeader(request);
    const [t, user] = await Promise.all([
        streamMessages(requestLocale),
        getCurrentUser(),
    ]);
    const userId = user?.id ?? null;

    // 봇도 이 분기를 사람과 동일하게 통과한다 — 봇이 사람과 다른 본문을 받으면 크롤러가 색인하는 DOM이
    // 달라진다(`route.ts` 상단 불변식).
    if (isE2E()) {
        return e2eTechnicalResponse({
            userId,
            symbol,
            reanalyze,
            genericErrorMessage: t('generic'),
        });
    }

    // 꺼진 서버 키 모델 대체는 게이트보다 먼저 해야 한다 — 꺼진 모델 그대로면 provider가 400으로 실패해
    // P1 알람 마커가 찍힌다(`resolveRequestModel` JSDoc).
    const { modelId, fallback: modelFallback } = resolveRequestModel(
        requestedModelId,
        { cacheOnly: cacheOnly === true }
    );

    // 시장 프로필·호가표와 tier+BYOK 게이트는 서로의 결과를 쓰지 않는다(심볼 vs userId) — 함께 기다려 DB
    // 왕복 한 단을 줄인다. 게이트가 막히면 프로필·호가표 결과는 버려진다(읽기 전용 조회라 부작용 없음).
    // 호가표는 판정하지 못하면 던지므로 yahoo 장애 때 한국 종목 요청은 게이트 결과보다 먼저 실패한다 —
    // 의도된 동작이다: 한국 종목은 봉도 yahoo라 어차피 분석할 수 없고, 추측한 표로 분석을 만들면 공유
    // 캐시 키에 남는다(`resolveKrxTickTable`). 30일 캐시라 게이트가 막힌 요청의 추가 조회는 대부분 적중이다.
    const [marketProfile, krxTickTable, gate] = await Promise.all([
        resolveMarketProfile(symbol),
        resolveKrxTickTable(symbol),
        modelId === undefined
            ? resolveTierOnly(userId).then((tier): ByokOutcome => ({
                  kind: 'allowed',
                  tier,
              }))
            : resolveTierAndByok(userId, modelId, requestLocale),
    ]);
    const descriptor = getDescriptor(marketProfile);
    const session = sessionSpecFor(marketProfile);
    const marketDataProvider = getCachedMarketDataProvider(session);

    if (gate.kind === 'blocked') {
        return gateDeniedResponse(requestLocale, gate.error.code, t('generic'));
    }
    const { tier, userApiKey } = gate;

    const positionBucket = await resolveHoldingPositionBucket({
        userId,
        tier,
        symbol,
        quoteSymbol: fmpSymbol,
        marketDataProvider,
        logTag: '[streamAnalysisRoute] position bucket resolution failed, degrading to no-bucket:',
    });

    // 생성 한도: 초과면 생성 대신 캐시 전용으로 강등한다(`skipEnqueueIfMiss`). 캐시가 있으면 평소대로
    // 내주고 없으면 `settleGenerationGate`가 `rate_limited` 이벤트로 바꾼다. 재분석 의도도 함께 무시한다 —
    // 캐시 우회는 곧 새 생성이다. 헤더는 크롤러 DNS 검증에만 쓴다(UA는 *시도할지*만 정한다).
    // 비회원 신원·크롤러 판정은 한도 예약과 미터가 한 번만 계산해 나눠 쓴다(쿠키 발급·DNS 조회가 요청당 한 번).
    const guest = createGuestResolver(request.headers);
    const quota = await quotaSlot.reserve(
        userId,
        cacheOnly === true,
        request.headers,
        guest
    );
    const quotaLimited = quota.kind === 'rate_limited';

    // 비회원 하루 무료 전체 공개 미터. 동시성 검사 **앞**에서 판정한다 — 그 검사와 스트림 생성 사이에는
    // await가 없어야 해서다. 대신 이후의 거절 경로(쿨다운·503·예외)는 신규 기록을 되돌려야 한다.
    // `cacheOnly` 요청도 미터를 탄다(캐시 적중 결과도 공개 대상).
    const meterGate = await resolveMeterGate({
        userId,
        tier,
        symbol,
        guest,
        now: new Date(),
    });
    if (meterGate.kind === 'revealed') {
        meterRelease.current = meterGate.release;
    }

    // core의 `onPromptAssembled`는 캐시 미스에서 정확히 한 번, 프로바이더 호출 직전에 **동기로** 캡처만
    // 한다 — await하지 않는다(응답 전 경로).
    let capturedPrompt: AssembledPromptRecord | undefined;

    const options: SubmitAnalysisOptions = {
        modelId,
        // UA가 아니라 클라이언트의 AI 자동 실행 게이트(`cacheOnly`)와 한도 강등에서만 온다.
        skipEnqueueIfMiss: cacheOnly === true || quotaLimited,
        marketDataProvider,
        // provider에 넘긴 세션과 **같은 값**을 core에 넘긴다 — 분석 캐시 TTL이 그 시장의 다음 정규장
        // 마감 + 30분(크립토는 다음 00:00 UTC)에 맞춰진다. 생략하면 모든 시장이 KST 05:00(미장 마감)
        // 경계를 써서 KR·크립토 분석이 직전 세션 가격을 들고 있었다.
        session,
        assetClass: descriptor.assetClass,
        // core는 심볼에서 통화를 추론하지 않는다 — 거래소 프로파일을 아는 쪽이 여기다. 넘기지 않으면
        // 원화 종목의 손절·목표가가 `$121980.70`처럼 달러 기호와 있지도 않은 소수 정밀도를 달고 나온다
        // (코퍼스 실측: 원화 종목 20건 중 19건).
        currency: descriptor.priceFormat.currency,
        // 표는 core 캐시 키에 접히지 않는다 — 모든 진입점이 같은 값을 넘겨야 한다.
        krxTickTable,
        tierContext: { userId, tier },
        reasoning: resolveReasoning(tier, reasoning),
        positionBucket,
        onPromptAssembled: record => {
            capturedPrompt = record;
        },
        ...(userApiKey !== undefined ? { userApiKey } : {}),
        // 공개 종목이면 마스킹만 member 깊이로 바꾼다. 캐시 키는 tier 기반이라 free 생성분을 그대로
        // 재사용한다(새 LLM 호출 없음).
        ...(meterGate.kind === 'revealed'
            ? { tierConfig: meterGate.tierConfig }
            : {}),
    };

    // `force`(캐시 우회)는 **클라이언트가 정하지 않는다.** 이 라우트는 인증 없는 공개 POST이므로 본문의
    // `force:true`를 믿으면 누구나 매 요청마다 서버 키로 LLM을 태울 수 있다. 클라이언트는 **의도**
    // (`reanalyze`)만 보내고, 실제 우회 여부는 재분석 쿨다운(Redis `SET NX EX 300`) 획득으로 정해 정상
    // 경로에서 (symbol, timeframe)당 5분에 한 번으로 제한된다.
    //
    // 한계: 이건 **비용 상한이지 보안 경계가 아니다**. `tryAcquireReanalyzeCooldown`은 Redis 장애 시
    // fail-open(`{ok:true}`)이라 Upstash가 죽으면 모든 reanalyze 요청이 force가 된다. 반대로 fail-closed면
    // Redis 장애가 재분석 기능 전체를 막는다. 진짜 상한은 요청 단위 생성 한도(`generationQuota.ts`, 비회원
    // fail-closed)이고 재분석도 새 생성이라 그 한도를 함께 소비한다.
    //
    // 획득은 **여기서만** 한다. 클라이언트가 미리 획득한 뒤 요청을 보내면 여기서의 획득이 반드시 실패해
    // 재분석이 영원히 캐시로 강등되고, 반대로 의도 없는 일반 제출이 획득에 성공해 캐시를 우회하게 된다.
    const cooldown = shouldAttemptReanalyze(reanalyze, quotaLimited)
        ? await tryAcquireReanalyzeCooldown(symbol, timeframe)
        : null;

    if (cooldown !== null && !cooldown.ok) {
        await releaseGenerationGate(quota);
        await meterRelease.current();
        return sseResponse(
            Promise.resolve({
                status: 'reanalyze_cooldown' as const,
                remainingMs: cooldown.remainingMs,
            }),
            t('generic')
        );
    }

    const force = cooldown?.ok === true;
    const releaseOnFailure = async (): Promise<void> => {
        if (!force) return;
        await releaseCooldownQuietly(
            symbol,
            timeframe,
            '[streamAnalysisRoute] cooldown release failed:'
        );
    };

    // 동시 분석 상한 — 근거는 `canAcceptAnalysisStream` 주석. 검사를 **작업 생성 직전**에 둔다. 진입부에서
    // 검사하면 게이팅 await 대여섯 개를 사이에 두게 되고, 그 창에 몰려든 요청이 전부 증가 전의 같은 카운트를
    // 읽어 모두 통과한다. 이 지점부터 `sseResponse`까지 await가 없어 단일 스레드에서 원자적이다(카운터
    // 증가는 `heartbeatStream`의 start에서 일어난다). 그래서 번역자도 이 검사 이전에 확보했다.
    // JSON 503으로 거절한다 — SSE로 error를 흘리면 클라이언트가 "분석 실패"로 표시하지만 이건 "나중에"다.
    // 사람/봇 구분 없이 같은 상한을 쓴다(검증된 크롤러도 예외가 아니다).
    if (!canAcceptAnalysisStream()) {
        console.warn('[analysis-stream] rejected: concurrency cap reached');
        await releaseOnFailure();
        await releaseGenerationGate(quota);
        await meterRelease.current();
        return busyResponse(t);
    }

    const generated = withDeadline(async deadlineSignal => {
        // 상한 검사 뒤, `runAnalysis` 앞에서 읽는다(`loadTechnicalPromptInputs` JSDoc). 이 클로저는
        // `withDeadline`이 `(async () => run(signal))()`로 부르므로 첫 `await`까지 동기 실행된다 —
        // `withDeadline` 호출 자체는 여전히 동기로 돌아와 검사와 스트림 등록 사이에 양보가 없다.
        const inputs = await loadTechnicalPromptInputs({
            symbol,
            timeframe,
            session,
        });

        return runAnalysis(symbol, companyName, timeframe, force, fmpSymbol, {
            ...options,
            ...inputs,
            // 로케일을 core에 그대로 넘긴다 — core가 대상 언어로 직접 쓰고(`outputLanguageContract`)
            // 로케일은 core 캐시 키에도 접힌다. 사후 번역에 기대면 core가 영어로 쓴 산출물이 "한국어를
            // 번역하라" 프롬프트로 들어가 망가진다.
            locale: requestLocale,
            signal: deadlineSignal,
        }).then(result => ({
            ...result,
            personalized: positionBucket !== undefined,
        }));
    }, t('timeout')).catch(async (err: unknown) => {
        await releaseOnFailure();
        throw err;
    });
    // 프롬프트가 조립됐다 = 이 요청이 LLM을 불렀다. 캐시 적중·동시 요청의 패자·프로바이더 호출 전 실패는
    // 조립되지 않으므로 환불된다.
    const work = settleGenerationGate(
        generated,
        quota,
        promptAssembledProbe(() => capturedPrompt !== undefined)
    );

    // 새로 생성된('done') 결과만 이력에 남긴다. ⚠️ `'done'`이 이 요청이 생성했다는 뜻은 아니다:
    // `dedupeInFlight`가 승자의 결과를 동시 요청의 패자 전원에게 넘겨 모두 `'done'`을 본다. 중복은
    // `prompt`가 없다는 사실을 기준으로 `saveAnalysisHistory` 안에서 걸러진다.
    // 아래 클라이언트 가지와 **독립된 구독자**라 자체 거절 핸들러가 필요하다 — 없으면 타임아웃·게이트
    // 에러가 unhandled rejection이 된다.
    work.then(result => {
        if (result.status !== 'done') return;
        schedulePersistAnalysisHistory({
            symbol,
            timeframe,
            tab: 'technical',
            modelId: modelId ?? DEFAULT_TECHNICAL_MODEL_ID,
            locale: requestLocale,
            // 이력에는 **필터 전** 결과를 남긴다. `result.result`는 이 요청의 tier가 *볼 수 있는* 만큼만
            // 담아 free는 `riskLevel`이 null이고, `PriorAnalysis`는 trend와 riskLevel을 모두 요구하므로
            // 그 모양으로 저장하면 이후 모든 읽기가 그 행을 버린다. 분석 대부분은 비회원 방문자와 SEO
            // pre-warm(캐시 키에 tier가 접혀 올릴 수 없다)이 만들므로 렌더용 값을 저장하면 이력이 정작
            // 그걸 채워야 할 트래픽에서 비게 된다.
            result: result.unfilteredResult,
            prompt: capturedPrompt,
        });
    }).catch(() => {
        // 실패·타임아웃·중단이라 저장할 게 없다. 실제 오류는 아래 클라이언트 가지로 이미 전달된다.
    });

    return sseResponse(
        attachModelFallback(
            withReaderViews(
                toClientWork(work, meterGate, () => meterRelease.current()),
                requestLocale,
                'technical',
                symbol
            ),
            modelFallback
        ),
        t('generic')
    );
}
