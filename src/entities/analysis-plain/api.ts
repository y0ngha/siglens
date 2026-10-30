import 'server-only';
import { extractProse } from '@/entities/analysis-translation/lib/proseFields';
import { isE2E } from '@/shared/api/e2eEnv';
import type { Locale } from '@/shared/i18n/locales';
import { PLAIN_PROMPT_VERSION, buildPlainPrompt } from './lib/buildPlainPrompt';
import { collectFacts, type CurrencyCode } from './lib/collectFacts';
import { buildAllowedNumbers } from './lib/guardPlainText';
import { dropSupersededPaths } from './lib/supersededPaths';
import {
    coordinatePlainGeneration,
    joinPlainFlight,
    NULL_TEXT,
} from './server/plainFlights';
import {
    startPlainGeneration,
    type PlainGenerationContext,
} from './server/plainGeneration';
import { tryReadPlainModelConfig } from './server/plainModel';
import {
    buildInputDigest,
    findStored,
    tryCreateRepository,
} from './server/plainStore';
import type { PlainGenerationKey } from './plainGenerationCoordination';

/**
 * 자체 마감. `withDeadline`의 `Promise.race`가 **이미 끝난 뒤** 붙는 레이어라
 * `STREAM_DEADLINE_MS`의 보호를 받지 못한다. 예전에는 어댑터가 timeout도 maxRetries도
 * 지정하지 않아 OpenAI SDK 기본값(10분 × 3회)을 썼다 — 프로바이더가 매달리면 스트림
 * 하나가 `canAcceptAnalysisStream` 동시성 슬롯을 30분 붙들고,
 * `instrumentation.node.ts`의 SIGTERM 드레인(`SHUTDOWN_DRAIN_DEADLINE_MS`)을 넘겨 배포마다 끊겼다.
 * 지금은 호출마다 `PLAIN_CALL_LIMITS`(`server/plainGeneration.ts`, 스트림 본문까지 묶는 `PLAIN_CALL_TIMEOUT_MS` 호출 마감, SDK 재시도 0)를
 * 넘기지만, 그 값은 백그라운드 지출의 상한이고 사용자가 기다리는 시간은 여전히 이 마감이 정한다.
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
 * 레이스에서 진 `attempt()`(`server/plainGeneration.ts`)도 DB에는 쓴다(`attempt()` 내부에서 직접 쓴다 — 아래
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
 * 마감을 건 실행. 초과하면 `null`.
 *
 * ⚠️ **레이스일 뿐 요청을 끊지는 못한다.** `callAiProviderRouter`가 넘겨받는
 * `ProviderCallOptions`에 `signal`이 없어(`entities/llm-provider/model.ts`)
 * 어댑터까지 취소를 전달할 방법이 없다. 그래서 마감을 넘긴 호출은 백그라운드에서
 * 계속 돌며 토큰을 청구한다 — 여기까지는 여전히 사실이다. 다만 그 수명은 이제 전송
 * timeout(`server/plainGeneration.ts`의 `PLAIN_CALL_LIMITS.timeoutMs`)으로 묶이고 SDK 재시도도 없다.
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
     * 가격 기준 시점 문구(`resolvePriceAsOf`). 호출자가 시장 세션에서 만들어 넘긴다.
     * 생략하면 프롬프트에 기준 시점이 없어 모델이 읽는 시점에 기대어 쓸 수 있다.
     */
    asOf?: string,
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
            currentPrice,
            asOf
        );
        // `facts.asOf`도 숫자 출처로 넘긴다 — 날짜(`9월 29일`)의 숫자가 허용 집합에 없으면
        // 모델이 그 날짜를 옮기는 순간 숫자 가드가 근거 없는 숫자로 볼 수 있다.
        const allowed = buildAllowedNumbers(facts.numbers, [
            ...entries.map(e => e.text),
            ...(facts.asOf !== undefined ? [facts.asOf] : []),
        ]);

        const basePrompt = buildPlainPrompt({ entries, facts, locale });
        // 키는 **현재가를 뺀** 프롬프트로 만든다. 현재가는 숫자 없는 분석(fundamental·news·
        // financials)에만 실리는 실시간 시세라(`resolveCurrentPrice`), 프롬프트째 해시하면
        // 장중(크립토는 상시) 시세가 움직일 때마다 같은 분석문이 새 키를 얻어 평이화를 다시
        // 돌렸다 — 분석 1건이 아니라 조회 1분당 1~2회 과금. 기준일 문구(`asOf`)는 키에 남긴다:
        // 그날 처음 만든 글을 그날 안에서 재사용하고(가격 앞에 그 날짜가 박혀 있어 참이다),
        // 날짜나 장중→종가가 바뀌면 새로 만든다. 현재가가 없는 경로(technical 등)는
        // `digestPrompt === basePrompt`라 기존 저장 행의 키가 그대로다.
        const digestPrompt =
            currentPrice === undefined
                ? basePrompt
                : buildPlainPrompt({
                      entries,
                      facts: collectFacts(
                          analysis,
                          symbol,
                          currency,
                          locale,
                          undefined,
                          asOf
                      ),
                      locale,
                  });
        const inputDigest = buildInputDigest(digestPrompt);

        const repository = tryCreateRepository();
        const stored = await findStored(repository, locale, inputDigest);
        if (typeof stored === 'string' && stored.length > 0) return stored;

        // 행에 만료가 없다 — 키가 내용 주소(입력 해시)라 같은 입력은 같은 출력이고,
        // 동시 생성이 겹쳐도 `ON CONFLICT DO NOTHING`이 흡수한다.
        const context: PlainGenerationContext = {
            symbol,
            locale,
            config: resolved,
            entries,
            facts,
            allowed,
            basePrompt,
            writeStored: text => {
                repository
                    ?.insert(PLAIN_PROMPT_VERSION, locale, inputDigest, text)
                    .catch(() => undefined);
            },
        };

        const key: PlainGenerationKey = {
            promptVersion: PLAIN_PROMPT_VERSION,
            locale,
            inputDigest,
        };
        const flight = joinPlainFlight(
            key,
            Date.now() + deadlineMs,
            waitUntil =>
                coordinatePlainGeneration(key, repository, waitUntil, () =>
                    startPlainGeneration(context)
                )
        );
        const result = await withDeadline(flight.result, deadlineMs);
        if (result !== null) return result;
        // 마감을 넘겼는데 첫 글이 연성 실패뿐이었다면 그 글을 돌려준다. 저장은 하지 않는다 —
        // 늦게 끝나는 생성이 스스로 더 나은 글이나 이 첫 글을 저장한다. 이미 끝난
        // 프라미스는 이미 해결된 값보다 먼저 `race`를 이기므로, 첫 시도가 끝났는지 이렇게 본다.
        return await Promise.race([flight.softDraft, NULL_TEXT]);
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
