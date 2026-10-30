import 'server-only';
import { callAiProviderRouter } from '@/entities/llm-provider/api/router';
import { stripMarkdownCodeBlock } from '@/entities/llm-provider/lib/parseJsonResponse';
import type { ProviderCallLimits } from '@/entities/llm-provider/model';
import type { ProseEntry } from '@/entities/analysis-translation/lib/proseFields';
import type { Locale } from '@/shared/i18n/locales';
import { buildPlainPrompt } from '../lib/buildPlainPrompt';
import type { PlainFacts } from '../lib/collectFacts';
import {
    describeFailure,
    guardPlainText,
    salvageByRemovingSentences,
    type GuardInput,
    type PlainGuardFailure,
} from '../lib/guardPlainText';
import { plainSystemInstruction } from '../lib/outputLanguage';
import {
    isSalvageableFailure,
    salvageBeforeRetry,
} from '../lib/salvageBeforeRetry';
import {
    PLAIN_CALL_TIMEOUT_MS,
    PLAIN_MAX_OUTPUT_TOKENS,
} from '../plainGenerationCoordination';
import type { PlainFlight } from './plainFlights';
import type { PlainModelConfig } from './plainModel';

/**
 * 평이화 호출 상한. 재시도는 SDK가 아니라 이 모듈이 정한다 — `attempt()`가 가드 실패에
 * 한 번 다시 부르는데, SDK 재시도(기본 2회)까지 겹치면 매달린 호출 하나가 백그라운드에서
 * 최대 세 번 청구된다. 마감(`withDeadline`)은 레이스일 뿐 요청을 끊지 못하므로 실제로
 * 끊는 것은 이 `timeoutMs`다.
 *
 * `timeoutMs`는 SDK 옵션이 아니라 **어댑터가 스트림 본문 읽기까지 묶는 호출 전체 마감**으로
 * 쓴다(`createCallDeadline`). OpenAI SDK의 `timeout`은 응답 헤더가 오면 타이머를 지우므로
 * SSE 본문은 그것만으로는 무제한이다 — 4,000토큰을 75~100토큰/초로 흘리는 긴 재작성이
 * 40~55초를 가는데, 이 값이 본문을 끊지 않으면 `plainGenerationCoordination.ts`의 락 TTL을
 * 넘겨 다른 인스턴스가 같은 좌표를 중복 생성한다.
 *
 * 재시도(`attempt(retryHint)`)는 첫 호출이 **돌아온 뒤 가드가 거부했을 때만** 일어난다.
 * 첫 호출이 마감(`ProviderCallTimeoutError`)으로 던지면 `generate()`의 파이프라인이 그
 * 거절을 잡아 `null`로 끝내므로 두 번째 호출은 없다 — 마감까지 멈춘 프로바이더에 마감을 한 번
 * 더 쓰지 않는다. 그래서 한 생성의 최악은 "느린 호출 + 가드 거부 + 느린 재시도"의 2회이고,
 * 이 2회를 락 TTL이 덮는다(`plainGenerationCoordination.ts`). SIGTERM 드레인
 * (`SHUTDOWN_DRAIN_DEADLINE_MS`)과의 관계: 호출 하나는 마감으로 끊기지만, 2회 최악
 * (`PLAIN_CALL_TIMEOUT_MS` × 2)은 드레인 예산과 같거나 겹칠 수 있다 — 드레인에서
 * 끊겨도 락은 TTL로 풀리고 저장 행이 없으니 다음 요청이 다시 생성한다.
 */
const PLAIN_CALL_LIMITS: ProviderCallLimits = {
    maxOutputTokens: PLAIN_MAX_OUTPUT_TOKENS,
    timeoutMs: PLAIN_CALL_TIMEOUT_MS,
    maxRetries: 0,
};

/** 로그에 남기는 손실 비율의 소수 자릿수. 0.25 상한 근처를 0.1% 단위로 구분하면 충분하다. */
const LOSS_RATIO_LOG_DIGITS = 3;

/**
 * 한 번의 평이화 생성에 필요한 입력. `rewriteToPlainLanguage`가 준비 단계에서 만든다.
 */
export interface PlainGenerationContext {
    readonly symbol: string;
    readonly locale: Locale;
    readonly config: PlainModelConfig;
    readonly entries: readonly ProseEntry[];
    readonly facts: PlainFacts;
    readonly allowed: GuardInput['allowed'];
    /** 재시도 지적 문구가 없는 첫 시도의 프롬프트. */
    readonly basePrompt: string;
    /**
     * fire-and-forget DB 쓰기. `attempt()`가 성공을 확정하는 지점마다 정확히 한 번 부른다.
     *
     * `withDeadline`의 `Promise.race` **바깥이 아니라 `attempt()` 안**에서 부르는 것이
     * 핵심이다 — 레이스에서 진 호출이 나중에 settle해도 이 콜백이 여전히 살아 있어 행을
     * 채운다. 응답을 늦추지 않도록 await하지 않고, 실패는 삼킨다(DB 장애가 평이화 성공을
     * 무너뜨리면 안 된다).
     */
    readonly writeStored: (text: string) => void;
}

/**
 * 연성 실패(`stale_deixis`)로 거부된 **첫 시도의 글**. 숫자·문자·조언 가드는 모두
 * 통과한 글이라 재시도가 실패해도 쓸 수 있다 — 재시도가 경성 위반으로 끝나 도려내기마저
 * `null`이거나, 마감을 넘기거나, 던져도 쉽게보기가 통째로 사라지지 않게 `attempt()`가
 * 이 값으로 돌려준다(저장도 재시도도 하지 않은 상태). 호출자가 재시도를 이어 간다.
 */
interface SoftFirstDraft {
    readonly soft: string;
    readonly tokens: readonly string[];
    readonly retryHint: string;
}

type AttemptResult = string | null | SoftFirstDraft;

const isSoftFirstDraft = (r: AttemptResult): r is SoftFirstDraft =>
    r !== null && typeof r === 'object';

/** 재시도 단계에서는 첫 시도 초안이 나올 수 없다 — 나오더라도 글은 버리지 않는다. */
const toFinalText = (r: AttemptResult): string | null =>
    isSoftFirstDraft(r) ? r.soft : r;

/** 연성 실패 — 시점 표현이 거칠 뿐 내용이 틀린 글이 아니라, 버리면 쉽게보기가 통째로 사라진다. 그대로 받아들여 저장한다. */
function acceptSoft(
    ctx: PlainGenerationContext,
    text: string,
    tokens: readonly string[]
): string {
    console.info('[analysisPlain] accepted with stale deixis', {
        symbol: ctx.symbol,
        locale: ctx.locale,
        tokens,
    });
    ctx.writeStored(text);
    return text;
}

/**
 * 첫 시도가 거부됐을 때의 처리. 연성 실패는 저장 없이 초안으로 돌려주고(호출자가 한 번만
 * 다시 쓰게 하며, 마감 초과일 때도 이 값으로 물러난다), 재시도 전에 도려낼 수 있으면
 * 도려낸 글을 저장하고, 아니면 지적 문구를 붙여 한 번 더 부른다.
 */
async function handleFirstRejection(
    ctx: PlainGenerationContext,
    text: string,
    failure: PlainGuardFailure
): Promise<AttemptResult> {
    if (failure.kind === 'stale_deixis') {
        return {
            soft: text,
            tokens: failure.tokens,
            retryHint: describeFailure(failure, ctx.locale),
        };
    }
    const salvagedFirst = salvageBeforeRetry(text, failure, ctx.allowed);
    if (salvagedFirst === null) {
        return toFinalText(
            await attempt(ctx, describeFailure(failure, ctx.locale))
        );
    }
    // 25% 상한의 근거가 표본 몇 건뿐이라 실제 손실 분포를 남겨 둔다 —
    // 저장된 문장은 프롬프트 버전이 바뀔 때까지 남으므로 상한을 다시 볼 근거다.
    console.info('[analysisPlain] salvaged without retry', {
        symbol: ctx.symbol,
        locale: ctx.locale,
        kind: failure.kind,
        originalChars: text.length,
        removedChars: text.length - salvagedFirst.text.length,
        lossRatio: Number(
            salvagedFirst.lossRatio.toFixed(LOSS_RATIO_LOG_DIGITS)
        ),
    });
    ctx.writeStored(salvagedFirst.text);
    return salvagedFirst.text;
}

/**
 * 재시도까지 실패했다. 시점 표현이 남았으면 한 번 더 부르지 않고 받아들이고, 그 밖에는
 * 통째로 버리기 전에 **어긋난 문장만 도려내** 본다.
 *
 * 위반은 대개 문장 한두 개에 몰려 있고(실측: 5건 전부 문장 1~3개 제거로
 * 잔여 위반 0), 문단 일부를 잃는 것이 쉽게보기가 통째로 사라지는 것보다
 * 낫다. 도려낸 결과는 `salvageByRemovingSentences`가 숫자 가드를 다시
 * 통과시킨 것만 돌려준다(길이 하한은 없다 — `guardPlainText` 참고).
 *
 * 크기 접미사(`1,573.1B`)는 살리지 않는다 — 자릿수가 틀린 금액이라
 * 문장을 빼는 것으로 고쳐지지 않고, 남겨 두면 10배 오류가 그대로 나간다.
 *
 * 조언 문구(`advice`)는 살린다 — 독자에게 행동을 권하는 문장 한두 개만
 * 빼면 나머지는 멀쩡한 설명이다. 여기서 버리면 그 종목은 쉽게보기가 통째로
 * 사라져 크롤러가 받는 본문이 전문 용어 원문으로 돌아간다.
 */
function handleRetryRejection(
    ctx: PlainGenerationContext,
    text: string,
    failure: PlainGuardFailure
): string | null {
    if (failure.kind === 'stale_deixis') {
        return acceptSoft(ctx, text, failure.tokens);
    }
    if (!isSalvageableFailure(failure)) return null;
    const salvaged = salvageByRemovingSentences(text, ctx.allowed);
    if (salvaged === null) return null;
    console.info('[analysisPlain] salvaged by sentence removal', {
        symbol: ctx.symbol,
        locale: ctx.locale,
        removedChars: text.length - salvaged.length,
    });
    ctx.writeStored(salvaged);
    return salvaged;
}

async function attempt(
    ctx: PlainGenerationContext,
    retryHint?: string
): Promise<AttemptResult> {
    const { locale } = ctx;
    const prompt =
        retryHint === undefined
            ? ctx.basePrompt
            : buildPlainPrompt({
                  entries: ctx.entries,
                  facts: ctx.facts,
                  locale,
                  retryHint,
              });
    const raw = await callAiProviderRouter({
        serverApiKey: ctx.config.serverApiKey,
        // BYOK 경로가 아니다 — 평이화는 항상 서버 부담이다.
        userApiKey: undefined,
        // `[Usage]` 텔레메트리에서 평이화 지출을 따로 본다.
        jobId: 'analysis-plain',
        model: ctx.config.model,
        contents: prompt,
        // 유저 프롬프트 본문이 한국어라, 끝에 붙인 언어 블록만으로는
        // 비-ko에서 무게가 밀린다(실측: zh 0/3). core처럼 계약을
        // 시스템 프롬프트에도 둔다. ko에서는 `undefined`다.
        systemInstruction: plainSystemInstruction(locale),
        limits: PLAIN_CALL_LIMITS,
    });
    const text = stripMarkdownCodeBlock(raw).trim();
    const failure = guardPlainText({ text, allowed: ctx.allowed, locale });
    if (failure === null) {
        ctx.writeStored(text);
        return text;
    }
    console.warn('[analysisPlain] guard rejected', {
        symbol: ctx.symbol,
        locale,
        kind: failure.kind,
        retry: retryHint !== undefined,
        // 거부 토큰을 남긴다 — 없으면 "모델이 지어냈는지" 대 "가드가 너무
        // 빡빡한지"를 사후에 가릴 수 없다. 실제로 그래서 KRW 재시도율이
        // USD의 6배인 원인을 특정하지 못했다.
        tokens: 'tokens' in failure ? failure.tokens : undefined,
    });
    return retryHint === undefined
        ? handleFirstRejection(ctx, text, failure)
        : handleRetryRejection(ctx, text, failure);
}

/**
 * 이 프로세스에서 이 좌표의 생성을 실제로 시작하는 쪽만 부른다. 실패(던짐)는 여기서
 * 기록하고 `null`로 바꾼다 — 공유되는 `result`는 reject하지 않아야 대기자 전원이
 * 같은 값을 받는다.
 */
export function startPlainGeneration(ctx: PlainGenerationContext): PlainFlight {
    const first = attempt(ctx);
    const pipeline = first.then(async (r): Promise<string | null> => {
        if (!isSoftFirstDraft(r)) return r;
        // 한 번만 다시 쓰게 한다. 재시도가 아무것도 못 돌려주면(경성 위반 +
        // 도려내기 실패, 프로바이더 오류) 첫 글을 받아들인다.
        const retried = await attempt(ctx, r.retryHint).then(
            toFinalText,
            () => null
        );
        return retried ?? acceptSoft(ctx, r.soft, r.tokens);
    });
    return {
        result: pipeline.catch((error: unknown) => {
            // 조용히 삼키지 않는다 — 키 오설정이나 모델 장애가 전 사용자에게
            // 쉽게보기를 없애는데 화면에는 아무 에러도 안 뜬다(원본이 나온다).
            console.error('[analysisPlain] failed', {
                symbol: ctx.symbol,
                locale: ctx.locale,
                model: ctx.config.model,
                error,
            });
            return null;
        }),
        softDraft: first.then(
            r => (isSoftFirstDraft(r) ? r.soft : null),
            () => null
        ),
    };
}
