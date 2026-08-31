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
 * 예산은 시도 횟수가 아니라 **전체**다. 첫 시도가 예산을 다 쓰면 재시도 없이 끝난다.
 */
const PLAIN_DEADLINE_MS = 45_000;

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

/** 마감을 건 실행. 초과하면 `null`. */
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
    currency?: CurrencyCode
): Promise<string | null> {
    // E2E는 LLM을 태우지 않는다. 키 부재에만 기대면(`tryReadPlainModelConfig`가
    // null을 돌려주므로 결과는 같다) 어느 날 키가 주입되는 순간 조용히 과금과
    // 비결정성이 들어온다. 분기를 명시해 둔다.
    if (isE2E()) return null;

    const entries = dropSupersededPaths(extractProse(analysis));
    if (entries.length === 0) return null;

    const config = tryReadPlainModelConfig();
    if (!config) return null;

    const facts = collectFacts(analysis, symbol, currency);
    const inputChars = entries.reduce((sum, e) => sum + e.text.length, 0);
    const allowed = buildAllowedNumbers(
        facts.numbers,
        entries.map(e => e.text)
    );

    const basePrompt = buildPlainPrompt({ entries, facts, locale });
    const key = buildCacheKey(basePrompt, locale);

    // 캐시 팩토리는 try 안에 둔다. 밖에 두면 팩토리가 던졌을 때 이 함수가 reject되고,
    // 호출자가 그걸 Promise.all에 넣으므로 거절이 전파돼 분석 전체가 실패한다 —
    // `null`로 떨어지는 이 레이어의 계약과 정반대다.
    try {
        const cache = createCacheProvider();
        const cached = await cache?.get<string>(key).catch(() => null);
        if (typeof cached === 'string' && cached.length > 0) return cached;

        const attempt = async (retryHint?: string): Promise<string | null> => {
            const prompt =
                retryHint === undefined
                    ? basePrompt
                    : buildPlainPrompt({ entries, facts, locale, retryHint });
            const raw = await callAiProviderRouter({
                serverApiKey: config.serverApiKey,
                // BYOK 경로가 아니다 — 평이화는 항상 서버 부담이다.
                userApiKey: undefined,
                // `[Usage]` 텔레메트리에서 평이화 지출을 따로 본다.
                jobId: 'analysis-plain',
                model: config.model,
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
            });
            return retryHint === undefined
                ? attempt(describeFailure(failure))
                : null;
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
            model: config.model,
            entryCount: entries.length,
            error,
        });
        return null;
    }
}
