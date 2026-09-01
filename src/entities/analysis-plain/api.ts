import 'server-only';
import { createHash } from 'node:crypto';
import { createCacheProvider } from '@y0ngha/siglens-core';
import {
    callAiProviderRouter,
    stripMarkdownCodeBlock,
} from '@/entities/llm-provider';
import { isE2E } from '@/shared/api/e2eEnv';
import { extractProse } from '@/entities/analysis-translation';
import { tryReadPlainModelConfig } from './lib/plainModel';
import type { Locale } from '@/shared/i18n/locales';
import { collectFacts, type CurrencyCode } from './lib/collectFacts';
import { dropSupersededPaths } from './lib/supersededPaths';
import { buildPlainPrompt, PLAIN_PROMPT_VERSION } from './lib/buildPlainPrompt';
import {
    buildAllowedNumbers,
    describeFailure,
    guardPlainText,
    salvageByRemovingSentences,
} from './lib/guardPlainText';

/**
 * 평이화 캐시 TTL. 원문이 바뀌면 해시가 달라져 스스로 무효화되므로 길게 잡는다.
 * `analysis-translation`의 번역 캐시와 같은 값이다.
 */
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

/**
 * 자체 마감. `withDeadline`의 `Promise.race`가 **이미 끝난 뒤** 붙는 레이어라
 * `STREAM_DEADLINE_MS`의 보호를 받지 못한다. 그런데 `callDeepseekChat`은 timeout도
 * maxRetries도 지정하지 않아 OpenAI SDK 기본값(10분 × 3회)을 쓴다 — 프로바이더가
 * 매달리면 스트림 하나가 `canAcceptAnalysisStream` 동시성 슬롯을 30분 붙들고,
 * `instrumentation.node.ts`가 전제하는 180초 SIGTERM 드레인을 넘겨 배포마다 끊긴다.
 *
 * ## 왜 45초가 아니라 15초인가
 *
 * 설계 초안은 "로케일 번역과 병렬이라 추가 지연이 두 마감의 **최댓값**"이라고 적었다.
 * **`ko`에서는 틀린 말이다** — `translateAnalysisForLocale`은 기본 로케일이면 즉시
 * 반환하므로(`analysis-translation/api.ts`) 병렬 상대가 없고, 이 마감이 그대로
 * 크리티컬 패스에 **순증**한다. 한국어 사용자 전원이 매 분석마다 이 값을 기다린다.
 *
 * 실측 지연은 6.9~13.5초(346회 전수 실행)다. 15초면 정상 응답을 거의 다 담고,
 * 프로바이더가 매달릴 때 사용자가 기다리는 시간을 3분의 1로 줄인다.
 *
 * ⚠️ **마감을 넘기면 캐시도 비어 있다.** 레이스에서 진 `attempt()`의 결과는 버려지고
 * 캐시 쓰기는 승자 경로에만 있으므로, 어떤 입력이 지속적으로 15초를 넘기면 그
 * 입력은 **매 요청마다** 15초를 쓰고 `plain: null`로 끝난다. 손실이 일회성이라고
 * 적었던 이전 주석은 틀렸다(감사 지적). 그런 입력이 관측되면 마감을 올릴 게 아니라
 * 캐시 쓰기를 `attempt()` 안으로 옮겨 고아 응답도 다음 요청에 쓰이게 해야 한다.
 *
 * 예산은 시도 횟수가 아니라 **전체**다. 첫 시도가 예산을 다 쓰면 재시도 없이 끝난다.
 */
const PLAIN_DEADLINE_MS = 15_000;

/**
 * 캐시 키. **원문 산문 + 사실 블록 전체의 해시 + 로케일**이다.
 *
 * 심볼·모델·타임프레임을 키에 넣지 않는다 — 같은 입력이면 결과가 같고, 입력이
 * 조금이라도 바뀌면 해시가 달라져 스스로 무효화된다.
 *
 * **티어도 넣지 않는다.** 입력이 core `filterAnalysisResult`를 통과한 payload이므로
 * free와 member는 산문 조각 수부터 달라 자동으로 다른 키를 얻는다(실측: free 5조각
 * vs member 21조각). 반대로 두 티어의 필터 결과가 실제로 같으면 같은 키를 공유하는데,
 * 그건 leak이 아니라 정확한 동작이다 — 티어 세그먼트를 넣으면 이 공유가 깨져
 * LLM 호출이 불필요하게 두 배가 된다.
 */
function buildCacheKey(prompt: string, locale: Locale): string {
    const digest = createHash('sha256').update(prompt).digest('hex');
    return `plain:${PLAIN_PROMPT_VERSION}:${locale}:${digest}`;
}

/**
 * 마감을 건 실행. 초과하면 `null`.
 *
 * ⚠️ **레이스일 뿐 요청을 끊지는 못한다.** `callAiProviderRouter`가 넘겨받는
 * `ProviderCallOptions`에 `signal`이 없어(`entities/llm-provider/model.ts`)
 * 어댑터까지 취소를 전달할 방법이 없다. 그래서 마감을 넘긴 호출은 백그라운드에서
 * 계속 돌며 토큰을 청구하고, 레이스가 이미 끝났으므로 **캐시도 쓰지 않는다**.
 *
 * 마감을 45초에서 15초로 줄인 이유 중 하나가 이것이다 — 고아 요청의 수명과
 * 사용자 대기 시간을 함께 줄인다. 근본 해결은 provider 어댑터 계약에 `signal`을
 * 추가하는 것이고, 그건 챗·번역 등 다른 호출자에도 영향을 주므로 별도 작업이다.
 */
function withDeadline<T>(work: Promise<T>, ms: number): Promise<T | null> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expiry = new Promise<null>(resolve => {
        timer = setTimeout(() => {
            console.error('[analysisPlain] deadline exceeded', { ms });
            resolve(null);
        }, ms);
    });
    return Promise.race([work, expiry]).finally(() => {
        if (timer !== undefined) clearTimeout(timer);
    });
}

/**
 * AI 분석 결과를 비전문가용 산문 한 덩어리로 다시 쓴다.
 *
 * ## 입력은 반드시 티어 필터를 통과한 payload여야 한다
 *
 * 산출물이 문자열 하나라 사후 필드 마스킹이 불가능하다. 필터 전 값을 넣으면 유료
 * 콘텐츠가 평문으로 그대로 샌다. SSE 라우트에서 이 함수는 액션 결과 봉투
 * (`{ result, lockedInfoDepth }`)를 받으므로 자연히 필터 뒤에 오지만, 그 순서가
 * 설계상 필수라 여기에 명시한다.
 *
 * ## 실패는 전부 `null`이다
 *
 * 설정 없음·모델 오류·가드 실패·마감 초과 모두 `null`을 돌려준다. 호출자는 원본
 * 뷰만 노출하고 토글을 감춘다. 부분 적용은 하지 않는다 — 숫자 하나가 틀린 매매
 * 안내는 원본을 보여주는 것보다 나쁘다.
 *
 * ⚠️ **SSE 경로에서는 반드시 `heartbeatStream(work)`의 `work` 안에서 호출한다.**
 * 바깥에서 await하면 첫 바이트까지의 침묵이 프록시 idle 한도에 걸린다
 * (2026-08 실측: cloudflared 경유 125.9초).
 */
export async function rewriteToPlainLanguage(
    analysis: unknown,
    symbol: string,
    locale: Locale,
    /**
     * 통화 코드. 호출자가 시장 프로파일에서 넘긴다.
     * 생략하면 모델이 단위 없는 맨 숫자를 쓸 수 있다 — `collectFacts`의 주석 참고.
     */
    currency?: CurrencyCode,
    /** 현재 주가. payload에 값이 없는 분석 타입에서 특히 중요하다. */
    currentPrice?: number
): Promise<string | null> {
    // E2E는 LLM을 태우지 않는다. 키 부재에만 기대면(`tryReadPlainModelConfig`가
    // null을 돌려주므로 결과는 같다) 어느 날 키가 주입되는 순간 조용히 과금과
    // 비결정성이 들어온다. 분기를 명시해 둔다.
    if (isE2E()) return null;

    /**
     * **준비 단계까지 전부 try 안에 둔다.**
     *
     * 이 함수는 "절대 reject하지 않는다"를 계약으로 내걸지만, 예전에는 `try`가
     * 준비 문장 여섯 개 **뒤에서** 시작했다. `tryReadPlainModelConfig`는 미처리
     * provider에 대해 의도적으로 throw하고, `collectNumbers`는 임의 객체를 무한
     * 재귀로 훑는다 — 둘 중 하나라도 던지면 호출자의 `Promise.all`을 통해
     * 거절이 전파돼 **성공한 분석이 "분석 실패"로 바뀐다.**
     * 장식 레이어가 분석을 죽이는 것은 이 설계에서 가장 피하려던 결과다.
     */
    let config: ReturnType<typeof tryReadPlainModelConfig> = null;
    try {
        const entries = dropSupersededPaths(extractProse(analysis));
        if (entries.length === 0) return null;

        config = tryReadPlainModelConfig();
        if (!config) return null;
        const resolved = config;

        const facts = collectFacts(
            analysis,
            symbol,
            currency,
            locale,
            currentPrice
        );
        const inputChars = entries.reduce((sum, e) => sum + e.text.length, 0);
        const allowed = buildAllowedNumbers(
            facts.numbers,
            entries.map(e => e.text)
        );

        const basePrompt = buildPlainPrompt({ entries, facts, locale });
        const key = buildCacheKey(basePrompt, locale);

        const cache = createCacheProvider();
        const cached = await cache?.get<string>(key).catch(() => null);
        if (typeof cached === 'string' && cached.length > 0) return cached;

        const attempt = async (retryHint?: string): Promise<string | null> => {
            const prompt =
                retryHint === undefined
                    ? basePrompt
                    : buildPlainPrompt({ entries, facts, locale, retryHint });
            const raw = await callAiProviderRouter({
                serverApiKey: resolved.serverApiKey,
                // BYOK 경로가 아니다 — 평이화는 항상 서버 부담이다.
                userApiKey: undefined,
                // `[Usage]` 텔레메트리에서 평이화 지출을 따로 본다.
                jobId: 'analysis-plain',
                model: resolved.model,
                contents: prompt,
            });
            const text = stripMarkdownCodeBlock(raw).trim();
            const failure = guardPlainText({ text, inputChars, allowed });
            if (failure === null) return text;
            console.warn('[analysisPlain] guard rejected', {
                symbol,
                locale,
                kind: failure.kind,
                retry: retryHint !== undefined,
                // 거부 토큰을 남긴다 — 없으면 "모델이 지어냈는지" 대 "가드가 너무
                // 빡빡한지"를 사후에 가릴 수 없다. 실제로 그래서 KRW 재시도율이
                // USD의 6배인 원인을 특정하지 못했다.
                tokens: 'tokens' in failure ? failure.tokens : undefined,
            });
            if (retryHint === undefined)
                return attempt(describeFailure(failure));

            /**
             * 재시도까지 실패했다. 통째로 버리기 전에 **어긋난 문장만 도려내** 본다.
             *
             * 위반은 대개 문장 한두 개에 몰려 있고(실측: 5건 전부 문장 1~3개 제거로
             * 잔여 위반 0), 문단 일부를 잃는 것이 쉽게보기가 통째로 사라지는 것보다
             * 낫다. 도려낸 결과는 `salvageByRemovingSentences`가 길이·숫자 가드를
             * 다시 통과시킨 것만 돌려준다.
             *
             * 크기 접미사(`1,573.1B`)는 살리지 않는다 — 자릿수가 틀린 금액이라
             * 문장을 빼는 것으로 고쳐지지 않고, 남겨 두면 10배 오류가 그대로 나간다.
             */
            if (failure.kind !== 'unsupported_numbers') return null;
            const salvaged = salvageByRemovingSentences(
                text,
                allowed,
                inputChars
            );
            if (salvaged !== null) {
                console.info('[analysisPlain] salvaged by sentence removal', {
                    symbol,
                    locale,
                    removedChars: text.length - salvaged.length,
                });
            }
            return salvaged;
        };

        const text = await withDeadline(attempt(), PLAIN_DEADLINE_MS);
        if (text === null) return null;

        // fire-and-forget: 캐시 쓰기가 응답을 늦추지 않는다.
        cache?.set(key, text, CACHE_TTL_SECONDS).catch(() => undefined);
        return text;
    } catch (error) {
        // 조용히 삼키지 않는다 — 키 오설정이나 모델 장애가 전 사용자에게 쉽게보기를
        // 없애는데 화면에는 아무 에러도 안 뜬다(원본이 나온다).
        console.error('[analysisPlain] failed', {
            symbol,
            locale,
            model: config?.model ?? null,
            error,
        });
        return null;
    }
}
