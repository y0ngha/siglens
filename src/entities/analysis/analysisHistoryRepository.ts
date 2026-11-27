/**
 * `analysis_history` / `analysis_prompt_blobs` 저장소.
 *
 * `node:crypto`(`sha256Hex`)를 import하는 `server-only` 모듈이라 서버 소비자만 import할
 * 수 있다. 클라이언트 컴포넌트가 이 모듈에 닿으면 예전에 barrel 누수로
 * `crypto-browserify`가 33개 라우트의 first-load JS에 실린 사고가 반복된다.
 */
import 'server-only';

import { createHash } from 'node:crypto';
import {
    and,
    desc,
    eq,
    gte,
    inArray,
    isNotNull,
    isNull,
    lt,
    notExists,
    or,
    sql,
} from 'drizzle-orm';
import {
    analysisHistoryQuery,
    type AnalysisHistoryAxis,
    type AssembledPromptRecord,
    type MarketSessionSpec,
    type PriorAnalysis,
    type Tier,
    type Timeframe,
} from '@y0ngha/siglens-core';
import { MS_PER_DAY, MS_PER_MINUTE } from '@/shared/config/time';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import { analysisHistory, analysisPromptBlobs } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import type { Locale } from '@/shared/i18n/locales';
import { withRetry } from '@/shared/lib/withRetry';
import { toPriorAnalysis } from './lib/toPriorAnalysis';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';

/** `analysis_history` 탭 축 — 현재는 technical/overall 둘뿐이다. */
export type AnalysisHistoryTab = 'technical' | 'overall';

/**
 * `result`(분석 본문) 보관 기간. `'1Day'` prior-analysis 윈도우가 21 거래일 ≈
 * 역법일 30일이고 core가 주말·공휴일 때문에 그 폭을 더 넓히므로(`analysisHistoryQuery`
 * 참고), 90일로 넉넉히 여유를 둔다. `schema.ts`의 `analysisHistory` JSDoc과
 * 동일한 근거 — 수정 시 두 곳을 함께 맞춘다.
 *
 * `'1Week'` prior-analysis 윈도우는 이 상한이 정한다 — 90일이면 주봉 이전 분석은 약 12~13주치만
 * 남는다(주봉 분석은 하루 한 번 이하로 만들어져 `PRIOR_ANALYSIS_LIMIT` 7건은 채우고도 남는다).
 * 더 긴 주봉 이력이 필요해지면 이 값을 늘려야 한다.
 */
export const RESULT_RETENTION_DAYS = 90;

/**
 * `prompt_dynamic`(가장 큰 컬럼) 보관 기간. 디버깅·오프라인 평가 전용이라
 * 최신성만 중요하다. prior-analysis 기능은 `result`만 읽으므로 이 컬럼을
 * 비워도 그 기능에는 영향이 없다 — `prompt_stable_hash`/`prompt_system_hash`/
 * `prompt_version`은 그대로 남겨 "어느 프롬프트 세대가 이 행을 만들었는지"는
 * 계속 식별 가능하게 한다(세 컬럼 모두 값이 작다).
 */
export const PROMPT_DYNAMIC_RETENTION_DAYS = 7;

/**
 * 한 번의 {@link DrizzleAnalysisHistoryRepository.pruneAnalysisHistory} 호출에서
 * 각 DELETE/UPDATE 문이 처리하는 최대 행 수.
 *
 * Postgres는 DELETE/UPDATE에 `LIMIT`을 직접 못 붙인다(MySQL 전용 확장이라
 * Drizzle의 `PgDeleteBase`/`PgUpdateBase`에도 `.limit()`이 없다) — 대신
 * `id IN (SELECT id FROM … LIMIT N)` 서브쿼리로 우회한다. 이 캡이 없으면
 * 몇 달째 자란 테이블에 대한 무제한 DELETE가 오래 잠그거나 서버리스 함수의
 * 시간 예산을 태울 수 있다. 한 번에 캡보다 더 지울 게 남아 있으면 이번
 * 호출은 이 값만큼만 처리하고 끝나며, 남은 몫은 다음 seo-prewarm cron
 * tick이 이어서 처리한다(만료 기준 삭제/클리어라 순서 의존성이 없어 여러
 * tick에 걸쳐 수렴해도 무해하다).
 */
export const PRUNE_BATCH_SIZE = 500;

/**
 * 고아 블롭 청소({@link DrizzleAnalysisHistoryRepository.pruneAnalysisHistory})가
 * 삭제할 수 있는 블롭의 최소 나이({@link analysisPromptBlobs.firstSeenAt} 기준).
 * 현재 어떤 `analysis_history` 행도 참조하지 않는 블롭이라도 이보다 어리면 지우지 않는다.
 *
 * **이것이 막는 경쟁.** `saveAnalysisHistory`는 트랜잭션 없는 두 번의 순차 쓰기를 한다 —
 * 프롬프트 블롭을 넣고, (네트워크 왕복 뒤) 그 해시를 가리키는 `analysis_history` 행을
 * 넣는다. 두 테이블 사이에는 의도적으로 FK가 없어(`pruneAnalysisHistory` JSDoc 참고)
 * 그 틈에 고아 청소가 돌 수 있다: 막 들어온, 아직 참조 행이 없는 블롭을 보고 지우면,
 * 뒤이은 history insert가 아무것도 가리키지 않는 해시를 남긴다. 조용한 손실이다 —
 * `result`는 영향이 없지만(prior-analysis는 그 컬럼만 읽는다) 그 행은 까닭 없이
 * 프롬프트를 잃는다.
 *
 * **이 값이 안전한 이유.** 두 쓰기 사이의 간격은 블롭 insert 한 번의 왕복과
 * `DB_TRANSIENT_RETRY` 백오프 예산(`backoffBudgetMs: 5000`, `isTransientDbError.ts`)으로
 * 묶이므로 수 초면 일시적인 Neon 재시도를 포함한 모든 현실적 경우를 덮는다. 5분은 그보다
 * 두세 자릿수 크고 앱 인스턴스와 Neon 사이의 시계 오차도 흡수한다. 기다려도 비용이 없다 —
 * 청소는 여전히 고아인 블롭을 이후 호출에서 집어 가고, {@link PRUNE_BATCH_SIZE}를 넘긴
 * 나머지를 이월하는 것과 같다.
 */
export const ORPHAN_BLOB_MIN_AGE_MS = 5 * MS_PER_MINUTE;

/**
 * 분석이 자기 생성 시각을 싣고 있으면 그 시각, 아니면 지금.
 *
 * `AnalysisResponse.analyzedAt`은 core가 결과를 만들 때 찍는 ISO 문자열이다. 선택
 * 필드이고, 잘못된 값이면 행을 오염시키면 안 된다 — 파싱 불가 날짜는 `Invalid Date`가
 * 되어 이 컬럼을 읽는 모든 정렬·윈도우 쿼리를 조용히 깨뜨린다.
 *
 * `analysis_history` 작성자 둘이 공유한다 — SSE 라우트(`app/api/analysis/stream/_lib/persistAnalysisHistory.ts`)와
 * SEO 프리웜 seam(`entities/analysis/api.ts`의 `prewarmTechnical`/`prewarmOverall`). 가드가 한 곳에만
 * 있게 하려는 것이다. app 레이어 라우트가 아니라 여기 둔 이유는 `api.ts`가 `app/`을
 * import할 수 없는 반면(FSD 의존 방향) 두 호출자는 이 저장소 모듈을 직접 import할 수
 * 있어서다.
 */
export function resolveGeneratedAt(result: unknown): Date {
    const stamped =
        typeof result === 'object' && result !== null
            ? Reflect.get(result, 'analyzedAt')
            : undefined;
    if (typeof stamped === 'string') {
        const parsed = new Date(stamped);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
}

export interface SaveAnalysisHistoryInput {
    symbol: string;
    timeframe: string;
    tab: AnalysisHistoryTab;
    modelId: string;
    /** 감사용 컬럼 — 저장만 하고 읽기 필터로는 쓰지 않는다 (schema.ts `analysisHistory` JSDoc 참고). */
    locale: Locale;
    /** core가 정규화한 AnalysisResponse. jsonb 컬럼에 그대로 적재. */
    result: unknown;
    generatedAt: Date;
    /**
     * core `onPromptAssembled`이 **캐시 미스에서 정확히 한 번** 넘겨준 레코드.
     *
     * 이 필드의 부재는 "이 요청이 분석을 생성하지 않았다"와 동의어다. core는
     * `dedupeInFlight` factory **안에서만** 콜백을 부르므로, 같은 캐시 키로 겹친
     * 요청 중 승자만 받고 패자는 승자의 결과를 공유받는다 — 둘 다 `status: 'done'`을
     * 보게 된다. 그래서 저장 여부를 `status`로 판정할 수 없고, 이 필드로 판정한다
     * (`saveAnalysisHistory` 참고).
     */
    prompt?: AssembledPromptRecord;
    inputFingerprint?: string;
    /**
     * 이 분석을 생성한 요청의 tier. 생략하면 `NULL`로 남는다. 응답에 필터가 적용된 뒤의 tier가
     * 아니라 **생성 시점** tier다(free 프리웜과 회원 분석은 스킬 세트가 다르다).
     */
    tier?: Tier;
    /**
     * 이 분석이 보유 맞춤(`positionBucket`이 프롬프트에 들어감)이었는지. 맞춤 분석은 "보유자 관점"
     * 서술과 그에 맞춘 계획을 담아 한 회원의 보유 상태를 드러내므로, 다른 사람에게 보이는 읽기가
     * 이 값으로 거른다. 필수 필드라 작성자가 반드시 명시한다.
     */
    personalized: boolean;
}

/** `findLatestShareable` 입력. */
export interface FindLatestShareableInput {
    symbols: readonly string[];
    timeframe: '1Day';
    tab: 'technical';
    /** 이 시각 이후에 생성된 행만. */
    notBefore: Date;
}

/** `findShareableAt` 입력. */
export interface FindShareableAtInput {
    symbol: string;
    timeframe: '1Day';
    tab: 'technical';
    /** 읽을 행의 `generated_at`(밀리초까지 정확히 같은 행). */
    generatedAt: Date;
}

/**
 * `findShareableAt` 결과. "행이 없다"(보존 기간 경과 — 영원히 같은 답)와 "읽지 못했다"(DB 오류 — 곧 달라질 수 있는
 * 답)를 가른다. 호출자가 앞의 것은 오래 캐시하고 뒤의 것은 캐시하지 않는다.
 */
export type FindShareableAtResult =
    | { status: 'found'; row: ShareableAnalysisRow }
    | { status: 'absent' }
    | { status: 'failed' };

/** `findLatestShareable`이 심볼마다 돌려주는 행. */
export interface ShareableAnalysisRow {
    symbol: string;
    generatedAt: Date;
    tier: string | null;
    result: unknown;
}

/**
 * 다른 사람에게 보여 줘도 되는 행만 남기는 조건 — 이전 분석 읽기(`findRecentForPrompt`)가 쓴다.
 *
 * - `personalized = false`: 작성자가 맞춤이 아니라고 기록한 행.
 * - `personalized IS NULL AND tier = 'free'`: 이 컬럼이 생기기 전 행 중 free tier가 생성한 것.
 *   free는 포지션 버킷을 만들지 않으므로(`resolvePositionBucket`) 맞춤일 수 없다.
 *
 * 그 밖의 `NULL`(회원 tier이거나 tier를 모르는 옛 행)은 맞춤이었는지 알 수 없어 버린다. 맞춤 결과에는
 * 보유 상태(손익 구간)를 드러내는 서술이 있을 수 있어서 안전한 쪽을 택했다. 보존 90일이 지나면 그런 행은
 * 사라진다.
 */
function priorAnalysisReadable() {
    return or(
        eq(analysisHistory.personalized, false),
        and(
            isNull(analysisHistory.personalized),
            eq(analysisHistory.tier, 'free')
        )
    );
}

/** `findRecentForPrompt` 입력. */
export interface FindRecentForPromptInput {
    symbol: string;
    timeframe: string;
    tab: AnalysisHistoryTab;
    /** 이 이력이 먹이는 캐시 축. 기본 `'technical'`. */
    axis?: AnalysisHistoryAxis;
    /**
     * `generatedBeforeMs`(현재 캐시 버킷) 제외를 건너뛴다. 현재 캐시 윈도우 안이든
     * 아니든 절대 최신 행이 필요한 호출자 전용이다. 기본 `false`(축출 루프에 안전한 동작).
     */
    includeCurrentWindow?: boolean;
    now?: Date;
    /**
     * 호출자가 이 분석의 core 호출(`runAnalysis`의 `session` / overall의
     * `technical.session`)에 넘기는 시장 세션 스펙. `analysisHistoryQuery`로 전달해
     * `generatedBeforeMs`가 core가 캐시 키의 이력을 자를 때 쓰는 세션 마감 경계와
     * 같은 곳에 놓이게 한다(예: KRX 1Day는 05:00 KST가 아니라 세션 마감에서 넘어간다).
     * 여기서 어긋나면 아래 축출 루프가 다시 열린다. 호출자가 core에도 생략할 때만
     * 생략한다.
     */
    session?: MarketSessionSpec;
}

function sha256Hex(body: string): string {
    return createHash('sha256').update(body, 'utf8').digest('hex');
}

/**
 * `pruneAnalysisHistory`의 결과 — 이번 실행이 실제로 처리한 양.
 *
 * 두 수치는 서로 다른 보존 주기를 반영한다: 행 자체는 90일 뒤 삭제되고,
 * `prompt_dynamic`은 7일 뒤 비워진다(행은 남는다). 배치 상한에 걸려
 * 남은 분량은 다음 크론 틱이 가져가므로, 이 값이 0이 아니라는 것은
 * "더 지울 게 남았을 수도 있다"는 뜻이다.
 */
export interface PruneAnalysisHistoryResult {
    /** 90일 보존 기간을 넘겨 삭제된 `analysis_history` 행 수. */
    rowsDeleted: number;
    /** 7일이 지나 `prompt_dynamic`을 비운 행 수(행 자체는 유지된다). */
    promptsCleared: number;
}

/**
 * Drizzle ORM 기반 `analysis_history` / `analysis_prompt_blobs` 영속화.
 *
 * **전체가 best-effort다.** 호출 시점엔 분석 응답이 이미 사용자에게 나간
 * 뒤라 여기서 던지면 성공한 요청이 실패로 보인다. 모든 에러를 흡수하고
 * 로그만 남긴다 — `saveAnalysisHistory`는 절대 reject하지 않는다.
 */
export class DrizzleAnalysisHistoryRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /**
     * 이력 한 건을 남긴다. **`prompt`가 없으면 아무것도 쓰지 않는다.**
     *
     * ## 왜 prompt 부재가 곧 skip인가
     *
     * 호출부는 core가 준 `status: 'done'`으로 "새로 생성됐다"를 판정하지만 그것으로는
     * 부족하다. `dedupeInFlight`는 같은 캐시 키로 겹친 요청 중 **승자의 factory만**
     * 실행하고 나머지에는 그 결과를 그대로 나눠 준다. 패자도 `'done'`을 받으므로,
     * `status`만 보면 **한 번의 분석이 동시 요청 수만큼 행을 만든다.**
     *
     * 실측(2026-09-05 운영): AAPL 1Day에서 LLM 호출은 1회(`latency 32.8s`)인데 행은
     * 2건이 남았고, 그중 하나만 프롬프트를 갖고 있었다.
     *
     * 그 중복은 조용히 기능을 무력화한다. 프롬프트에 실리는 이력은 최근
     * `PRIOR_ANALYSIS_LIMIT`건인데, 그 자리가 **같은 시점의 복제본**으로 차면
     * 모델에게 "이전 분석들"이라며 한 시점을 여러 번 보여 주게 된다 — 서로 다른
     * 시점의 판단을 비교시키려는 설계 의도와 정반대다.
     *
     * 승자를 남기는 쪽이 옳은 이유는 하나 더 있다: 프롬프트가 함께 남아야 결과를
     * 그 입력과 대조할 수 있다. 프롬프트 없는 행은 중복인 데다 품질 추적도 불가능해
     * 남길 이유가 없다.
     */
    async saveAnalysisHistory(input: SaveAnalysisHistoryInput): Promise<void> {
        const prompt = input.prompt;
        if (prompt === undefined) return;

        // 읽기가 버릴 행은 쓰지 않는다 — 판정은 읽기와 **같은 함수**로 한다. 조건을 다시 적으면 읽기 쪽
        // 판정이 바뀔 때 조용히 어긋난다(저장은 되는데 읽히지 않거나 그 반대).
        //
        // 두 작성자(SSE 라우트, SEO 프리웜)는 tier 필터 **전** 결과를 넘기므로 free 경로의 행도 `riskLevel`을
        // 갖고 여기를 통과한다. 이 검사는 필터된 결과가 새어 들어오거나 정규화가 깨진 입력을 막는 안전망이다.
        if (
            toPriorAnalysis({
                result: input.result,
                generatedAt: input.generatedAt,
            }) === null
        ) {
            return;
        }

        try {
            const promptHashes = {
                stableHash: sha256Hex(prompt.stable),
                systemHash: sha256Hex(prompt.system),
            };

            // 블롭을 먼저 upsert한다 — history 행이 가리킬 해시가 존재해야
            // 한다(FK는 없지만 쓰기 순서로 동일한 불변식을 지킨다).
            await withRetry(
                () =>
                    this.db
                        .insert(analysisPromptBlobs)
                        .values([
                            {
                                hash: promptHashes.stableHash,
                                body: prompt.stable,
                            },
                            {
                                hash: promptHashes.systemHash,
                                body: prompt.system,
                            },
                        ])
                        .onConflictDoNothing({
                            target: analysisPromptBlobs.hash,
                        }),
                DB_TRANSIENT_RETRY
            );

            await withRetry(
                () =>
                    this.db.insert(analysisHistory).values({
                        symbol: input.symbol,
                        timeframe: input.timeframe,
                        tab: input.tab,
                        modelId: input.modelId,
                        tier: input.tier ?? null,
                        personalized: input.personalized,
                        locale: input.locale,
                        result: input.result,
                        inputFingerprint: input.inputFingerprint ?? null,
                        promptVersion: prompt.promptVersion,
                        promptStableHash: promptHashes.stableHash,
                        promptSystemHash: promptHashes.systemHash,
                        promptDynamic: prompt.dynamic,
                        generatedAt: input.generatedAt,
                    }),
                DB_TRANSIENT_RETRY
            );
        } catch (err) {
            console.error(
                '[analysisHistoryRepository] persist failed:',
                redactDbErrorForLog(err)
            );
        }
    }

    /**
     * (symbol, timeframe, tab) 하나의 최근 이전 분석을 읽어 core의 `priorAnalyses`
     * 옵션을 먹인다.
     *
     * **`model_id`와 `locale`로는 일부러 거르지 않는다.** 두 컬럼은 감사용으로만
     * `analysis_history`에 있다 — 테이블 JSDoc(`shared/db/schema.ts`) 참고. 분석은
     * 출력 로케일별로 생성되지만(분석 1회에 LLM 호출 4번) core가 `PriorAnalysis`로 만드는
     * 요약은 숫자·enum뿐이라 언어 중립이고, 네 로케일이 한 이력 풀을 공유한다. 로케일로
     * 거르면 까닭 없이 데이터가 1/4로 줄어든다. `model_id`도 같다: 과거의 시장 판단
     * (추세·위험·레벨)은 어느 모델이 냈든 과거의 시장 판단이다. **이를 "고치려고"
     * `WHERE model_id = ...`나 `WHERE locale = ...`을 넣지 말 것 — 이 주석이 막으려는
     * 바로 그 실수다.**
     *
     * 쿼리 크기는 손으로 고른 상수가 아니라 core의 `analysisHistoryQuery(timeframe, axis,
     * now, session)`(`limit` + `sinceMs` + `generatedBeforeMs`)로 정한다. core가 하류에서
     * 두 번 다시 좁히는 의도적으로 거친 사전 필터이고, 여기서 덜 가져오면 기능이 조용히
     * 꺼진다. 이 쿼리를 `analysisHistoryQuery`가 돌려주는 것보다 좁히지 말 것.
     *
     * **`generatedBeforeMs` — 축출 루프 수정(운영 실측, PLTR 1Day, 2026-09-29).**
     * `ORDER BY generated_at DESC LIMIT limit`은 core가 결과를 캐시 키 지문으로 좁히기
     * **전에** 돈다. 윈도우 안 행이 `limit`을 채우면, 새로 생성될 때마다 가장 오래된
     * 윈도우 밖 행이 *이 쿼리의* 결과 집합에서도 밀려난다 — 생존 집합(그리고 core가 그것에서
     * 도출하는 `:hist=` 지문)이 생성할 때마다 바뀌어, 바로 다음 요청이 캐시를 놓치고 영원히
     * 재생성한다. 현재 캐시 버킷 안의 행(`generated_at < generatedBeforeMs`, core의 키
     * 좁히기와 같은 앵커 버킷 시작)을 제외하면 결과 집합이 버킷이 건드릴 수 없는 행에만
     * 의존해 새 생성이 그것을 밀어낼 수 없다. 현재 버킷을 포함한 가장 최신 행이 필요한
     * 호출자(예: "지금 있는 것 아무거나"를 원하는 챗 폴백)는 `includeCurrentWindow: true`로
     * 이 상한을 건너뛴다.
     *
     * **맞춤 분석은 읽지 않는다**({@link priorAnalysisReadable}). 이전 분석은 모든 호출자의 프롬프트와 에이전트
     * 이력 요약에 들어가므로, 한 회원의 보유자 관점 분석이 다른 사람에게 새면 안 된다. 읽는 행 집합이 달라지면
     * core가 도출하는 `:hist=` 지문도 한 번 바뀐다(배포 직후 캐시 미스 한 번, 이후 수렴).
     *
     * 각 행의 `result` jsonb는 {@link toPriorAnalysis}로 `PriorAnalysis`에 매핑한다.
     * `trend`/`riskLevel`이 없거나 문자열이 아닌 행은 버리고, 비유한 가격은 통과시키지
     * 않고 값 단위로 걷어 낸다.
     *
     * **`saveAnalysisHistory`처럼 best-effort다.** 이력 읽기는 분석 요청을 실패시키거나
     * 인덱스 쿼리 하나 이상으로 느리게 해선 안 된다. 어떤 실패(연결 불량, 깨진 행 등)든
     * 로그를 남기고 `[]`로 해소한다 — core 입장에서는 "이 symbol/timeframe/tab에 아직
     * 이력이 없다"와 바이트 단위로 같다.
     */
    async findRecentForPrompt(
        input: FindRecentForPromptInput
    ): Promise<PriorAnalysis[]> {
        try {
            const now = input.now ?? new Date();
            const { limit, sinceMs, generatedBeforeMs } = analysisHistoryQuery(
                input.timeframe as Timeframe,
                input.axis ?? 'technical',
                now,
                input.session
            );
            const since = new Date(now.getTime() - sinceMs);

            const rows = await withRetry(
                () =>
                    this.db
                        .select({
                            result: analysisHistory.result,
                            generatedAt: analysisHistory.generatedAt,
                        })
                        .from(analysisHistory)
                        .where(
                            and(
                                eq(analysisHistory.symbol, input.symbol),
                                eq(analysisHistory.timeframe, input.timeframe),
                                eq(analysisHistory.tab, input.tab),
                                gte(analysisHistory.generatedAt, since),
                                priorAnalysisReadable(),
                                ...(input.includeCurrentWindow
                                    ? []
                                    : [
                                          lt(
                                              analysisHistory.generatedAt,
                                              new Date(generatedBeforeMs)
                                          ),
                                      ])
                            )
                        )
                        .orderBy(desc(analysisHistory.generatedAt))
                        .limit(limit),
                DB_TRANSIENT_RETRY
            );

            return rows
                .map(toPriorAnalysis)
                .filter((mapped): mapped is PriorAnalysis => mapped !== null);
        } catch (err) {
            console.error(
                '[analysisHistoryRepository] findRecentForPrompt failed:',
                redactDbErrorForLog(err)
            );
            return [];
        }
    }

    /**
     * 심볼마다 `notBefore` 이후의 가장 최근 **맞춤이 아닌** 분석 한 건.
     *
     * `personalized = false`만 읽는다 — `NULL`(옛 행)은 `tier = 'free'`여도 쓰지 않는다. 이 읽기는 한 사람의
     * 분석을 다른 사람에게 보여 주는 용도(메일 등)라 확정된 행만 쓴다. best-effort: 실패하면 로그를 남기고
     * 빈 맵을 돌려준다.
     */
    async findLatestShareable(
        input: FindLatestShareableInput
    ): Promise<Map<string, ShareableAnalysisRow>> {
        const found = new Map<string, ShareableAnalysisRow>();
        if (input.symbols.length === 0) return found;
        try {
            const rows = await withRetry(
                () =>
                    this.db
                        .selectDistinctOn([analysisHistory.symbol], {
                            symbol: analysisHistory.symbol,
                            generatedAt: analysisHistory.generatedAt,
                            tier: analysisHistory.tier,
                            result: analysisHistory.result,
                        })
                        .from(analysisHistory)
                        .where(
                            and(
                                inArray(analysisHistory.symbol, [
                                    ...input.symbols,
                                ]),
                                eq(analysisHistory.timeframe, input.timeframe),
                                eq(analysisHistory.tab, input.tab),
                                eq(analysisHistory.personalized, false),
                                gte(
                                    analysisHistory.generatedAt,
                                    input.notBefore
                                )
                            )
                        )
                        .orderBy(
                            analysisHistory.symbol,
                            desc(analysisHistory.generatedAt)
                        ),
                DB_TRANSIENT_RETRY
            );
            for (const row of rows) found.set(row.symbol, row);
        } catch (err) {
            console.error(
                '[analysisHistoryRepository] findLatestShareable failed:',
                redactDbErrorForLog(err)
            );
            return new Map();
        }
        return found;
    }

    /**
     * 지정한 시각에 만들어진 공유 가능한 분석 한 행. 메일의 차트 이미지 URL이 `findLatestShareable`이 고른 분석을
     * 시각으로 고정해 두므로(`a=<generatedAt>`), 이미지 라우트가 나중에 새 분석이 생겨도 같은 행을 다시 읽는다.
     *
     * `findLatestShareable`과 같은 이유로 `personalized = false`만 읽는다. 행이 없으면 `absent`, 읽기에 실패하면(로그를
     * 남기고) `failed`다 — 둘 다 호출자가 작도 없는 차트로 떨어지지만 캐시 정책이 다르다.
     */
    async findShareableAt(
        input: FindShareableAtInput
    ): Promise<FindShareableAtResult> {
        try {
            const rows = await withRetry(
                () =>
                    this.db
                        .select({
                            symbol: analysisHistory.symbol,
                            generatedAt: analysisHistory.generatedAt,
                            tier: analysisHistory.tier,
                            result: analysisHistory.result,
                        })
                        .from(analysisHistory)
                        .where(
                            and(
                                eq(analysisHistory.symbol, input.symbol),
                                eq(analysisHistory.timeframe, input.timeframe),
                                eq(analysisHistory.tab, input.tab),
                                eq(analysisHistory.personalized, false),
                                eq(
                                    analysisHistory.generatedAt,
                                    input.generatedAt
                                )
                            )
                        )
                        .limit(1),
                DB_TRANSIENT_RETRY
            );
            const row = rows[0];
            return row === undefined
                ? { status: 'absent' }
                : { status: 'found', row };
        } catch (err) {
            console.error(
                '[analysisHistoryRepository] findShareableAt failed:',
                redactDbErrorForLog(err)
            );
            return { status: 'failed' };
        }
    }

    /**
     * `analysis_history` / `analysis_prompt_blobs` 보존 기간 청소. 호출자는 seo-prewarm
     * cron이고, 주 작업 뒤에 돈다 — 그 라우트의 JSDoc 참고.
     *
     * 서로 일부러 다른 두 주기다 — {@link RESULT_RETENTION_DAYS},
     * {@link PROMPT_DYNAMIC_RETENTION_DAYS}(그리고 `schema.ts`의 `analysisHistory` JSDoc):
     *
     * 1. {@link RESULT_RETENTION_DAYS}를 넘긴 행을 삭제한다.
     * 2. 살아남은 행 중 {@link PROMPT_DYNAMIC_RETENTION_DAYS}를 넘기고 아직
     *    `prompt_dynamic`이 있는 행의 그 컬럼**만** 비운다 —
     *    `prompt_stable_hash`/`prompt_system_hash`/`prompt_version`은 건드리지 않는다.
     * 3. 더 이상 어떤 `analysis_history` 행도 참조하지 않는(`prompt_stable_hash`로도
     *    `prompt_system_hash`로도) 해시의 `analysis_prompt_blobs`를 청소한다. 최종
     *    상태를 보도록 1–2 **뒤에** 돈다 — 블롭을 실제로 고아로 만드는 건 1이다(2는
     *    해시 컬럼을 건드리지 않아 혼자서는 아무것도 고아로 만들 수 없다). 두 테이블의
     *    보존 기간이 달라도 이 청소가 가능하도록 FK를 두지 않았다(schema.ts).
     *    {@link ORPHAN_BLOB_MIN_AGE_MS}보다 오래된 블롭만 대상이다 — 그 상수가 막는
     *    동시 쓰기 경쟁을 참고.
     *
     * 모든 문장은 {@link PRUNE_BATCH_SIZE}행으로 제한된다 — 이유와 한 호출이 다 지우지
     * 못할 때의 동작은 그 상수를 참고.
     *
     * **`saveAnalysisHistory`/`findRecentForPrompt`처럼 best-effort다.** 보존 기간
     * 청소가 그것을 싣고 가는 cron을 무너뜨려선 안 된다. 어떤 실패든 로그를 남기고 0으로
     * 채운 개수로 해소한다.
     */
    async pruneAnalysisHistory(
        now: Date = new Date()
    ): Promise<PruneAnalysisHistoryResult> {
        try {
            const deletedRows = await this.deleteRowsPastRetention(now);
            const clearedRows = await this.clearExpiredPromptDynamic(now);
            const deletedBlobs = await this.deleteOrphanBlobs(now);
            console.log(
                `[analysisHistoryRepository] prune: ${deletedRows.length} row(s) deleted, ${clearedRows.length} prompt(s) cleared, ${deletedBlobs.length} orphan blob(s) deleted`
            );

            return {
                rowsDeleted: deletedRows.length,
                promptsCleared: clearedRows.length,
            };
        } catch (err) {
            console.error(
                '[analysisHistoryRepository] pruneAnalysisHistory failed:',
                redactDbErrorForLog(err)
            );
            return { rowsDeleted: 0, promptsCleared: 0 };
        }
    }

    /** (1) 결과 보존 기간을 넘긴 행을 삭제한다. */
    private deleteRowsPastRetention(now: Date): Promise<{ id: string }[]> {
        const resultCutoff = new Date(
            now.getTime() - RESULT_RETENTION_DAYS * MS_PER_DAY
        );
        const staleRowIds = this.db
            .select({ id: analysisHistory.id })
            .from(analysisHistory)
            .where(lt(analysisHistory.generatedAt, resultCutoff))
            .limit(PRUNE_BATCH_SIZE);

        return withRetry(
            () =>
                this.db
                    .delete(analysisHistory)
                    .where(inArray(analysisHistory.id, staleRowIds))
                    .returning({ id: analysisHistory.id }),
            DB_TRANSIENT_RETRY
        );
    }

    /** (2) 살아남은 행 중 더 짧은 보존 기간을 넘긴 행의 `prompt_dynamic`을 비운다. */
    private clearExpiredPromptDynamic(now: Date): Promise<{ id: string }[]> {
        const promptCutoff = new Date(
            now.getTime() - PROMPT_DYNAMIC_RETENTION_DAYS * MS_PER_DAY
        );
        const promptClearIds = this.db
            .select({ id: analysisHistory.id })
            .from(analysisHistory)
            .where(
                and(
                    lt(analysisHistory.generatedAt, promptCutoff),
                    isNotNull(analysisHistory.promptDynamic)
                )
            )
            .limit(PRUNE_BATCH_SIZE);

        return withRetry(
            () =>
                this.db
                    .update(analysisHistory)
                    .set({ promptDynamic: null })
                    .where(inArray(analysisHistory.id, promptClearIds))
                    .returning({ id: analysisHistory.id }),
            DB_TRANSIENT_RETRY
        );
    }

    /**
     * (3) 살아남은 행이 참조하지 않는 블롭을 청소한다 — 삭제 이후 상태를 보도록 마지막에
     * 계산한다. `notInArray`가 아니라 `notExists`여야 한다: 해시 컬럼이 nullable이고,
     * `NOT IN (NULL이 섞인 서브쿼리)`는 서브쿼리가 NULL을 하나라도 돌려주는 순간 모든
     * 행에서 3값 논리 UNKNOWN이 되어 고아를 영원히 남긴다.
     *
     * `lt(firstSeenAt, blobAgeCutoff)`는 `saveAnalysisHistory`와의 insert 순서 경쟁을
     * 막는다 — 무엇을 막고 창을 왜 그 크기로 잡았는지는 `ORPHAN_BLOB_MIN_AGE_MS` 참고.
     * 이것이 없으면 막 들어온(아직 `analysis_history` 행이 없는) 블롭이 진짜 고아와
     * 구별되지 않아 여기서 삭제된다.
     */
    private deleteOrphanBlobs(now: Date): Promise<{ hash: string }[]> {
        const blobAgeCutoff = new Date(now.getTime() - ORPHAN_BLOB_MIN_AGE_MS);
        const orphanBlobHashes = this.db
            .select({ hash: analysisPromptBlobs.hash })
            .from(analysisPromptBlobs)
            .where(
                and(
                    lt(analysisPromptBlobs.firstSeenAt, blobAgeCutoff),
                    notExists(
                        this.db
                            .select({ one: sql`1` })
                            .from(analysisHistory)
                            .where(
                                eq(
                                    analysisHistory.promptStableHash,
                                    analysisPromptBlobs.hash
                                )
                            )
                    ),
                    notExists(
                        this.db
                            .select({ one: sql`1` })
                            .from(analysisHistory)
                            .where(
                                eq(
                                    analysisHistory.promptSystemHash,
                                    analysisPromptBlobs.hash
                                )
                            )
                    )
                )
            )
            .limit(PRUNE_BATCH_SIZE);

        return withRetry(
            () =>
                this.db
                    .delete(analysisPromptBlobs)
                    .where(inArray(analysisPromptBlobs.hash, orphanBlobHashes))
                    .returning({ hash: analysisPromptBlobs.hash }),
            DB_TRANSIENT_RETRY
        );
    }
}
