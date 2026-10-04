import 'server-only';
import { createHash } from 'node:crypto';
import { callAiProviderRouter } from '@/entities/llm-provider/api/router';
import { stripMarkdownCodeBlock } from '@/entities/llm-provider/lib/parseJsonResponse';
import { isE2E } from '@/shared/api/e2eEnv';
import { tryGetDatabaseClient } from '@/shared/db/client';
import { isOfflineBuild } from '@/shared/api/offlineBuild';
import type { PlainTextRepository } from '@/shared/db/types';
import { extractProse } from '@/entities/analysis-translation/lib/proseFields';
import { DrizzlePlainTextRepository } from './plainTextRepository';
import { tryReadPlainModelConfig } from './lib/plainModel';
import type { Locale } from '@/shared/i18n/locales';
import { collectFacts, type CurrencyCode } from './lib/collectFacts';
import { dropSupersededPaths } from './lib/supersededPaths';
import { buildPlainPrompt, PLAIN_PROMPT_VERSION } from './lib/buildPlainPrompt';
import { plainSystemInstruction } from './lib/outputLanguage';
import {
    buildAllowedNumbers,
    describeFailure,
    guardPlainText,
    salvageByRemovingSentences,
    type GuardInput,
    type PlainGuardFailure,
} from './lib/guardPlainText';

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
 * **틀린 말이었다.** 그 사후 번역 계층은 이제 아예 없고(core가 대상 언어로 직접
 * 쓴다), 이 마감은 로케일과 무관하게 크리티컬 패스에 **순증**한다. 모든 사용자가
 * 매 분석마다 이 값을 기다린다.
 *
 * 실측 지연은 6.9~13.5초(346회 전수 실행)다. 15초면 정상 응답을 거의 다 담고,
 * 프로바이더가 매달릴 때 사용자가 기다리는 시간을 3분의 1로 줄인다.
 *
 * 레이스에서 진 `attempt()`도 DB에는 쓴다(`attempt()` 내부에서 직접 쓴다 — 아래
 * `withDeadline` 주석 참고). 그래도 이 사용자 경로의 마감은 여전히 15초다 — 이
 * 값이 지키는 것은 지출이 아니라 **첫 요청자가 기다리는 시간**이고, 마감을 넘기는
 * 입력이 있으면 그 요청자는 여전히 `plain: null`을 받는다. 다음 요청부터 저장된 행을
 * 맞는 것으로 지출 낭비만 없앨 뿐이다.
 *
 * ⚠️ **그 "다음 요청"은 사실상 이 사용자 경로에만 있다.** 프리웜 크론은 같은
 * 프롬프트로 다시 부르지 않는다 — 저장 키가 원문 산문의 해시인데 그 산문이 매일 밤
 * 새로 생성되기 때문이고, 게다가 일곱 탭 중 여섯(overall·news·fundamental·
 * financials·options·congress)은 스냅샷 행이 생기고 나면 클라이언트 위젯을 아예
 * 마운트하지 않아 방문자도 이 함수를 다시 부르지 않는다(`harvest.ts`의 XOR 게이팅
 * 주석). 즉 DB 쓰기 이동이 프리웜에서 회수하는 돈은 사실상 없다 — 프리웜 쪽
 * 이득은 전적으로 **마감 상향**(30초, `harvest.ts`)이 raw miss율을 낮추는 데서 온다.
 * 이 문단이 있는 이유: 이 이동을 "프리웜 비용 절감"으로 읽고 다음 사람이 엉뚱한
 * 기대를 세우지 않게 하려는 것이다.
 *
 * 예산은 시도 횟수가 아니라 **전체**다. 첫 시도가 예산을 다 쓰면 재시도 없이 끝난다.
 *
 * 프리웜 크론처럼 기다리는 사람이 없는 호출자는 `rewriteToPlainLanguage`의
 * `deadlineMs` 인자로 이 값을 덮어쓸 수 있다 — 자세한 이유는 그쪽 호출부 주석 참고.
 */
const PLAIN_DEADLINE_MS = 15_000;

/**
 * 저장 키의 `input_digest`. **원문 산문 + 사실 블록 전체의 해시**이고, 로케일과
 * 프롬프트 버전은 복합 PK의 다른 열이다(`analysis_plain_texts`).
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
function buildInputDigest(prompt: string): string {
    return createHash('sha256').update(prompt).digest('hex');
}

/**
 * 저장소 조회 상한(ms). DB 클라이언트(postgres-js)는 연결 타임아웃(`connect_timeout`)만
 * 있고 쿼리 단위 타임아웃을 걸지 않아 DB가 매달리면 `find`가
 * 영영 끝나지 않고, 이 조회는 `withDeadline` **바깥**(생성 앞단)이라 그대로 사용자
 * 대기로 이어진다. 넘기면 미스로 취급하고 생성으로 넘어간다 — 정상 조회는 한 자릿수
 * ~수십 ms라 2.5초면 일시적 지연은 담으면서 매달림은 끊는다. 늦게 끝난 조회 결과는
 * 버려지고, 같은 키로의 중복 생성은 `ON CONFLICT DO NOTHING`이 흡수한다.
 */
export const PLAIN_STORE_READ_TIMEOUT_MS = 2_500;

let loggedDbUnavailable = false;

/**
 * DB가 없으면(`DATABASE_URL` 부재·오프라인 빌드) `null` — 호출자는 저장소 미스로
 * 취급하고 쓰기를 건너뛴다. 클라이언트 생성이 던져도 같다: 저장소 장애가
 * 평이화 생성 자체를 막아서는 안 된다.
 *
 * 다만 **조용히 넘어가지 않는다.** 저장소가 없으면 모든 요청이 LLM을 다시 부르는데
 * (비용), 예전 Redis 캐시도 미설정이면 똑같이 동작했기에 막지는 않는다. 대신 운영
 * 환경 오설정을 알아챌 수 있게 프로세스당 한 번 `console.error`를 남긴다 —
 * 요청마다 남기면 로그가 범람한다. 오프라인 빌드는 `tryGetDatabaseClient`가 따로
 * 경고하고, E2E는 이 함수에 도달하기 전에 끝나므로 둘 다 제외한다.
 */
function tryCreateRepository(): PlainTextRepository | null {
    try {
        const client = tryGetDatabaseClient();
        if (client === null) {
            if (!loggedDbUnavailable && !isE2E() && !isOfflineBuild()) {
                loggedDbUnavailable = true;
                console.error(
                    '[analysis-plain] DB unavailable — plain texts will be regenerated on every request (LLM cost)'
                );
            }
            return null;
        }
        return new DrizzlePlainTextRepository(client.db);
    } catch (error) {
        console.error('[analysisPlain] repository unavailable', { error });
        return null;
    }
}

/**
 * 저장소 조회. 실패는 미스, `PLAIN_STORE_READ_TIMEOUT_MS`를 넘겨도 미스다.
 * 타이머는 조회가 끝나는 즉시 정리한다.
 */
async function findStored(
    repository: PlainTextRepository | null,
    locale: Locale,
    inputDigest: string
): Promise<string | null> {
    if (repository === null) return null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>(resolve => {
        timer = setTimeout(() => {
            console.warn('[analysisPlain] store read timed out', {
                ms: PLAIN_STORE_READ_TIMEOUT_MS,
            });
            resolve(null);
        }, PLAIN_STORE_READ_TIMEOUT_MS);
    });
    try {
        return await Promise.race([
            repository
                .find(PLAIN_PROMPT_VERSION, locale, inputDigest)
                .catch(() => null),
            timeout,
        ]);
    } finally {
        if (timer !== undefined) clearTimeout(timer);
    }
}

/**
 * 마감을 건 실행. 초과하면 `null`.
 *
 * ⚠️ **레이스일 뿐 요청을 끊지는 못한다.** `callAiProviderRouter`가 넘겨받는
 * `ProviderCallOptions`에 `signal`이 없어(`entities/llm-provider/model.ts`)
 * 어댑터까지 취소를 전달할 방법이 없다. 그래서 마감을 넘긴 호출은 백그라운드에서
 * 계속 돌며 토큰을 청구한다 — 여기까지는 여전히 사실이다.
 *
 * **다만 그 돈이 완전히 버려지지는 않는다.** 예전에는 결과 저장(당시엔 Redis 캐시)이
 * 이 레이스의 승자 경로에만 있어서, 레이스에서 진 호출이 나중에 끝나도 그 결과는
 * 버려지고 저장소도 비어 있었다 — 어떤 입력이 지속적으로 마감을 넘기면 **매 요청마다**
 * 같은 돈을 다시 썼다(7일 감사: `deadline exceeded` 146건, 그만큼의 결과 전량
 * 폐기). 지금은 DB 쓰기가 `attempt()` 내부, 레이스 바깥에 있다 — 진 쪽이 나중에
 * settle해도 `attempt()`가 스스로 행을 채우므로, 다음 요청은 그 결과를 그대로
 * 맞는다. 이 함수가 반환하는 `null`은 그대로다 — 첫 요청자는 여전히 기다리지
 * 않고 원본을 본다. 바뀐 것은 그 요청자 **다음**부터다.
 *
 * 마감을 45초에서 15초로 줄인 이유 중 하나가 고아 요청의 수명과 사용자 대기
 * 시간을 함께 줄이는 것이었다 — 그건 여전히 유효하다. 근본 해결은 provider
 * 어댑터 계약에 `signal`을 추가하는 것이고, 그건 챗·번역 등 다른 호출자에도
 * 영향을 주므로 별도 작업이다.
 *
 * 레이스에서 진 `work`가 **나중에 reject해도** unhandled rejection이 되지 않는다 —
 * `Promise.race`가 settle 여부와 무관하게 `work`에 핸들러를 이미 붙여 두기
 * 때문이다. 그 늦은 거절은 로그 없이 사라지는데, 의도된 동작이다: 이 요청의
 * 실패는 위 `deadline exceeded`로 이미 기록됐고, 늦게 온 프로바이더 오류를
 * 따로 남겨도 호출자가 할 수 있는 일이 없다.
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
 * 첫 시도가 "근거 없는 숫자"로 거부됐을 때 **재시도 전에** 그 문장만 도려내도 되는 상한.
 *
 * 2026-10 실측(14일): 첫 시도 거부 2,038건(호출의 ~9%)이 전부 재생성으로 이어졌고, 거부
 * 전체(재시도 포함 2,696건)의 73%가 `unsupported_numbers`였다(첫 시도만의 비율은 따로 안 쟀다). 위반은 대개 문장 한두 개라(재시도 실패 뒤 살린 사례 전부
 * 문장 1~3개 제거) 짧게 도려내면 끝나는 것을 LLM 한 번을 더 불러 고쳤다. 원문의 25%
 * 이하만 잃으면 도려낸 결과를 그대로 쓰고, 그보다 많이 잃으면 재생성이 낫다고 본다.
 * 크기 접미사(`magnitude_suffix`)·문자 혼입 등 다른 거부는 도려내서 고쳐지지 않으므로
 * 그대로 재시도한다.
 *
 * 조언 문구(`advice`, 2026-10-04 도입)도 같은 경로로 도려낸다. 다만 25% 상한은 숫자 위반
 * 실측에서 나온 값이고 조언 쪽은 측정이 없다 — 로그의 `kind`로 두 분포를 갈라 다시 본다.
 *
 * ## 위 수치를 다시 세는 법
 *
 * 거부는 `attempt()`가 `console.warn('[analysisPlain] guard rejected', { symbol, locale,
 * kind, retry, tokens })`로 매번 한 번씩 남긴다. CloudWatch Logs Insights, 로그 그룹
 * `/siglens/app`, 14일 범위:
 *
 *     fields @timestamp, @message
 *     | filter @message like "[analysisPlain] guard rejected"
 *     | stats count() as rejections
 *
 * - 거부 전체(2,696건)는 위 마커 줄 수, 그중 첫 시도만(2,038건)은 `retry: false`인 건이다.
 * - 종류별 비율(`unsupported_numbers` 73%)은 같은 필드의 `kind`로 가른다. Node는 객체를
 *   여러 줄로 찍으므로 awslogs가 필드마다 별개 이벤트로 쪼갤 수 있다 — 그러면
 *   `filter @message like "kind: 'unsupported_numbers'"` 줄 수를 마커 줄 수로 나눈다.
 *   쪼개졌는지는 먼저 `limit 20`으로 원문을 보고 정할 것.
 * - 이 상한을 도입한 뒤의 실제 손실 분포는 `[analysisPlain] salvaged without retry`의
 *   `lossRatio`로 본다(아래 `console.info`). 이 로그는 도입 전 기간에는 없어 위 14일 수치를
 *   과거로 재현하는 데는 못 쓴다.
 */
const SALVAGE_BEFORE_RETRY_MAX_LOSS = 0.25;

/** 로그에 남기는 손실 비율의 소수 자릿수. 0.25 상한 근처를 0.1% 단위로 구분하면 충분하다. */
const LOSS_RATIO_LOG_DIGITS = 3;

interface SalvagedBeforeRetry {
    text: string;
    /** 잃은 글자 비율(0~1). 상한 판정과 로그가 같은 값을 쓰도록 한 번만 계산한다. */
    lossRatio: number;
}

function salvageBeforeRetry(
    text: string,
    failure: PlainGuardFailure,
    allowed: GuardInput['allowed']
): SalvagedBeforeRetry | null {
    // 조언 문구(`advice`)도 같은 이유로 도려낸다 — 위반이 문장 한두 개라 재생성할 이유가 없다.
    if (failure.kind !== 'unsupported_numbers' && failure.kind !== 'advice')
        return null;
    const salvaged = salvageByRemovingSentences(text, allowed);
    if (salvaged === null) return null;
    // `text`가 빈 문자열일 수 없다 — 두 종류 모두 `guardPlainText`가 `trim()` 뒤
    // 비어 있지 않음을 확인한 다음에야 나오는 종류다(빈 입력은 `empty`로 먼저 끝난다).
    // 설령 0이 되어도 `0 / 0`은 NaN이고 `NaN <= 상한`은 거짓이라 null로 떨어져 안전하다.
    const lossRatio = (text.length - salvaged.length) / text.length;
    return lossRatio <= SALVAGE_BEFORE_RETRY_MAX_LOSS
        ? { text: salvaged, lossRatio }
        : null;
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
    currentPrice?: number,
    /**
     * 마감(ms). 생략하면 `PLAIN_DEADLINE_MS`(15초) — 사용자가 화면 앞에서
     * 기다리는 SSE 경로가 이 기본값을 쓴다. 기다리는 사람이 없는 호출자
     * (프리웜 크론)만 더 긴 값을 넘긴다. 자세한 근거는 각 호출부 주석 참고.
     */
    deadlineMs: number = PLAIN_DEADLINE_MS
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
        /*
         * 가격 표기는 **여기서 손대지 않는다.** 한때 원화 종목에 `$`가 붙고
         * 소수점이 11자리까지 나오는 문제를 이 레이어에서 다듬었는데, 그건
         * core의 `reconciledLevels` 포맷 결함이었고 core 0.54.0이 통화를 받아
         * 원천에서 고쳤다. 산문을 하류에서 고쳐 쓰면 통화 기호마다 언어별
         * 접미사를 붙여야 하고, 그 접미사가 비-ko 산문에 한국어를 주입한다.
         */
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
        const allowed = buildAllowedNumbers(
            facts.numbers,
            entries.map(e => e.text)
        );

        const basePrompt = buildPlainPrompt({ entries, facts, locale });
        const inputDigest = buildInputDigest(basePrompt);

        const repository = tryCreateRepository();
        const stored = await findStored(repository, locale, inputDigest);
        if (typeof stored === 'string' && stored.length > 0) return stored;

        /**
         * fire-and-forget DB 쓰기. `attempt()`가 성공을 확정하는 두 지점
         * (가드 통과, 문장 도려내기로 살림) 각각에서 정확히 한 번 부른다.
         *
         * `withDeadline`의 `Promise.race` **바깥이 아니라 `attempt()` 안**에
         * 두는 것이 이 함수의 핵심이다 — 레이스에서 진 호출이 나중에 settle해도
         * 이 클로저가 여전히 살아 있어 행을 채운다. 응답을 늦추지 않도록
         * await하지 않고, 실패는 삼킨다(DB 장애가 평이화 성공을 무너뜨리면
         * 안 된다). 자세한 배경은 `withDeadline` JSDoc 참고.
         *
         * 행에 만료가 없다 — 키가 내용 주소(입력 해시)라 같은 입력은 같은 출력이고,
         * 동시 생성이 겹쳐도 `ON CONFLICT DO NOTHING`이 흡수한다.
         */
        const writeStored = (text: string): void => {
            repository
                ?.insert(PLAIN_PROMPT_VERSION, locale, inputDigest, text)
                .catch(() => undefined);
        };

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
                // 유저 프롬프트 본문이 한국어라, 끝에 붙인 언어 블록만으로는
                // 비-ko에서 무게가 밀린다(실측: zh 0/3). core처럼 계약을
                // 시스템 프롬프트에도 둔다. ko에서는 `undefined`다.
                systemInstruction: plainSystemInstruction(locale),
            });
            const text = stripMarkdownCodeBlock(raw).trim();
            const failure = guardPlainText({
                text,
                allowed,
                locale,
            });
            if (failure === null) {
                writeStored(text);
                return text;
            }
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
            if (retryHint === undefined) {
                const salvagedFirst = salvageBeforeRetry(
                    text,
                    failure,
                    allowed
                );
                if (salvagedFirst !== null) {
                    // 25% 상한의 근거가 표본 몇 건뿐이라 실제 손실 분포를 남겨 둔다 —
                    // 저장된 문장은 프롬프트 버전이 바뀔 때까지 남으므로 상한을 다시 볼 근거다.
                    console.info('[analysisPlain] salvaged without retry', {
                        symbol,
                        locale,
                        kind: failure.kind,
                        originalChars: text.length,
                        removedChars: text.length - salvagedFirst.text.length,
                        lossRatio: Number(
                            salvagedFirst.lossRatio.toFixed(
                                LOSS_RATIO_LOG_DIGITS
                            )
                        ),
                    });
                    writeStored(salvagedFirst.text);
                    return salvagedFirst.text;
                }
                return attempt(describeFailure(failure, locale));
            }

            /**
             * 재시도까지 실패했다. 통째로 버리기 전에 **어긋난 문장만 도려내** 본다.
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
            if (
                failure.kind !== 'unsupported_numbers' &&
                failure.kind !== 'advice'
            )
                return null;
            const salvaged = salvageByRemovingSentences(text, allowed);
            if (salvaged !== null) {
                console.info('[analysisPlain] salvaged by sentence removal', {
                    symbol,
                    locale,
                    removedChars: text.length - salvaged.length,
                });
                writeStored(salvaged);
            }
            return salvaged;
        };

        return await withDeadline(attempt(), deadlineMs);
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
