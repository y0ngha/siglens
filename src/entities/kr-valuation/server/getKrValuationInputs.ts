import 'server-only';
import {
    DART_MAX_RETRIES,
    DART_REQUEST_TIMEOUT_MS,
    dartFatalReason,
    fetchCompanyInfo,
    fetchFinancialStatementsAll,
    fetchStockTotalQuantity,
    isDartEnabled,
    type DartFsDiv,
    type DartRequestOptions,
} from '@/shared/api/dart/dartClient';
import {
    fetchKrxListedItemsOnOrBefore,
    hasDataGoKrCredentials,
    type KrxListedItem,
} from '@/shared/api/dataGoKr/krxListedInfoClient';
import { isE2E } from '@/shared/api/e2eEnv';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { SECONDS_PER_DAY } from '@/shared/config/time';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';
import { kstDateKey } from '@/shared/lib/etTimeUtils';
import { isDynamicServerError } from '@/shared/lib/isDynamicServerError';
import { withTimeout } from '@/shared/lib/withTimeout';
import { getKrDartCorp } from '@/entities/investor-flows/server/getKrDartCorp';
import {
    extractShareTotals,
    extractStatementFigures,
} from '../lib/dartAmounts';
import type { KrValuationData } from '../lib/computeKrValuation';
import {
    krReportCandidates,
    reportPeriodEnd,
    type KrReportCandidate,
} from '../lib/krReportCandidates';
import { toKrxShareCounts } from '../lib/krxShareCounts';
import { refreshShareCounts } from '../lib/refreshShareCounts';
import { shareReportOrder } from '../lib/shareReportOrder';
import type {
    KrProviderFallbackReason,
    KrReportCode,
    ShareTotals,
    StatementFigures,
} from '../model';

/**
 * # DART 호출 예산 (전 호출 `getOrSetCache` 뒤, 일일 카운터는 수집 크론과 공유한다)
 *
 * - **한 종목, 캐시가 비었을 때**: 기업 개황 1 + 최신 보고서 1(연결이 없는 회사는 별도까지 2) + 직전 사업연도 1 + 주식 표 1~3 = 4~6회.
 *   주식 표는 보고서 자신의 것이 먼저라(1·3분기도 채워 내는 회사가 있다) 자기 표가 비면 앞선 보고서 표를 더 읽는다: 3분기는 자기 표 → 반기 →
 *   전년 사업보고서 순으로 최대 3회. 앞선 표를 쓰면 KRX 상장주식수 1회(DART 호출이 아니고 아래 캐시를 탄다)가 붙는다.
 *   공시 창이 열린 보고서가 아직 안 올라왔으면 그 후보마다 연결·별도 2회가 더 든다. 요청 경로는 한 종목당 7회까지만 쓰고
 *   (`POLICY.request`), 넘으면 제공처 값으로 내려간다. 배경(프리웜)은 11회(후보 3개를 모두 헛짚는 최악).
 * - **캐시가 찼을 때**: 0회. 찾은 값은 30일, 없는 값은 마감 전 3일·마감 후 7일(`KR_MISSING_*`)이다. 단 이미 공시된 보고서 자신의 주식 표가
 *   비어 있다는 사실은 바뀌지 않아 30일이다(앞선 보고서 표를 못 찾은 경우만 7일). KRX 상장주식수는 확정된 과거 값이라 365일(빈 응답은 1일)이다.
 *   헛짚는 후보도 마감 3주 전(`krReportCandidates`)부터만 묻는다 — 기간 말 직후부터 묻던 때의 45일 매일 1회가 21일 3일에 1회로 준다.
 * - **하루 최악(상장 약 2,600종목 가정)**: 전 종목이 한꺼번에 비어도 종목당 4~6회라 약 1만 5천 회이고, 그 전에 `KR_VALUATION_RESERVE`가
 *   일일 예산(19,000)에서 6,000을 크론 몫으로 남겨 두므로 이 모듈은 카운터가 약 13,000에 닿으면 멈춘다(근사: 예약선을 읽고 증가시키는 사이에 진행 중이던 호출만큼, 즉 4 × 인스턴스 수 이하로 넘을 수 있다 — `reserveCall`). 평소(캐시가 30일에 걸쳐 돌아가는 정상 상태)는
 *   약 2,600 × 6 ÷ 30 ≈ 520회에 마감 전 3주의 헛짚기 ≤ 870회(2,600 ÷ 3)가 더해진다. 크론의 실제 일일 사용량은 이 모듈이 재지 않는다 —
 *   예약량은 보수적으로 잡은 값이다.
 * - **동시성**: 프로세스당 `KR_VALUATION_MAX_CONCURRENT`개 종목만 동시에 DART를 읽는다(프리웜이 몰려도 요청 경로의 호출이 줄 뒤로 밀리지 않도록
 *   요청 경로의 전체 시한이 대기 시간도 센다).
 */

/** 결산일 시점의 KRX 상장주식수는 확정된 과거 값이라 1년 둔다. */
const KRX_LISTED_SHARES_TTL_SECONDS = 365 * SECONDS_PER_DAY;
/** 그 기간에 행이 없으면(오류가 아니라 빈 응답) 하루 뒤 다시 묻는다. */
const KRX_LISTED_SHARES_MISSING_TTL_SECONDS = SECONDS_PER_DAY;
/** 갱신 전후 발행주식 총수가 이 비율 넘게 달라지면 로그를 남긴다(막지는 않는다). 분할·무상·병합이나 KRX 값 이상을 알아챈다. */
const SHARE_REFRESH_LOG_RATIO = 0.2;

/** 공시된 보고서는 정정이 드물어 길게 둔다. */
const FOUND_TTL_SECONDS = 30 * SECONDS_PER_DAY;
/** 마감 전에 없는 보고서는 사흘마다 다시 묻는다 — 일찍 내는 회사를 며칠 안에 잡는다. */
const KR_MISSING_BEFORE_DEADLINE_TTL_SECONDS = 3 * SECONDS_PER_DAY;
/** 마감이 지나도 없으면 연체·비상장 전환 등이라 이레마다 묻는다. */
const KR_MISSING_AFTER_DEADLINE_TTL_SECONDS = 7 * SECONDS_PER_DAY;

/** 수집 크론(`investor-flows`)을 위해 일일 호출 예산에서 남겨 두는 호출 수. 남은 예산이 이보다 적으면 이 모듈은 DART를 부르지 않는다. */
const KR_VALUATION_RESERVE = 6_000;
/** 프로세스당 동시에 DART를 읽는 종목 수. */
const KR_VALUATION_MAX_CONCURRENT = 4;

/** 12월 결산 법인의 `acc_mt`. */
const DECEMBER_FISCAL_YEAR = '12';
/** 최신순 후보 중 몇 번째까지 보고서를 찾아보는가. */
const MAX_REPORT_ATTEMPTS = 3;
const FS_DIVS: readonly DartFsDiv[] = ['CFS', 'OFS'];

/**
 * 어느 경로가 부르는가에 따라 요청 옵션·호출 수·전체 시한이 다르다(SERVER.md#SA-14).
 * - `request`: 화면 렌더·에이전트 도구. 요청 하나 2.5초, 재시도 없음, 종목당 7회, 전체 5초. 시한을 넘기면 제공처 값으로 내려간다.
 * - `background`: SEO 프리웜 등 기다리는 사람이 없는 경로. 크론 기본 옵션(30초·재시도 1회), 종목당 11회, 전체 2분.
 */
export type KrValuationMode = 'request' | 'background';

interface ModePolicy {
    request: DartRequestOptions;
    maxCalls: number;
    deadlineMs: number;
}

const POLICY: Record<KrValuationMode, ModePolicy> = {
    request: {
        request: {
            timeoutMs: 2_500,
            maxRetries: 0,
            reserve: KR_VALUATION_RESERVE,
        },
        maxCalls: 7,
        deadlineMs: 5_000,
    },
    background: {
        request: {
            timeoutMs: DART_REQUEST_TIMEOUT_MS,
            maxRetries: DART_MAX_RETRIES,
            reserve: KR_VALUATION_RESERVE,
        },
        maxCalls: 11,
        deadlineMs: 120_000,
    },
};

/** 종목 하나의 호출 수·시한을 세는 예산. 진짜 DART 호출(캐시 miss) 직전에만 쓴다. */
class CallBudget {
    private remaining: number;
    private readonly deadlineAtMs: number;

    constructor(maxCalls: number, deadlineAtMs: number) {
        this.remaining = maxCalls;
        this.deadlineAtMs = deadlineAtMs;
    }

    spend(): void {
        if (this.remaining <= 0 || Date.now() >= this.deadlineAtMs) {
            throw new KrValuationBudgetError();
        }
        this.remaining -= 1;
    }
}

class KrValuationBudgetError extends Error {
    constructor() {
        super('kr-valuation DART call budget or deadline exhausted');
        this.name = 'KrValuationBudgetError';
    }
}

const statementsKey = (
    corpCode: string,
    year: number,
    reportCode: KrReportCode,
    fsDiv: DartFsDiv
): string => `dart:fs:v1:${corpCode}:${year}:${reportCode}:${fsDiv}`;

const stockTotalsKey = (
    corpCode: string,
    year: number,
    reportCode: KrReportCode
): string => `dart:stock-totqy:v2:${corpCode}:${year}:${reportCode}`;

/** KRX 상장주식수 — 결산일 이전 마지막 거래일의 행(우선주 포함)이라 결산일이 정해지면 값이 바뀌지 않는다. */
const krxListedSharesKey = (prefix: string, periodEnd: string): string =>
    `krx:listed-shares:v1:${prefix}:${periodEnd}`;

const companyKey = (corpCode: string): string => `dart:company:v1:${corpCode}`;

/** 찾은 값은 길게, 없는 값은 `missingTtl`만큼 캐시한다. */
const ttlFor =
    (missingTtlSeconds: number) =>
    (value: unknown): number =>
        value === null ? missingTtlSeconds : FOUND_TTL_SECONDS;

interface LoadContext {
    budget: CallBudget;
    options: DartRequestOptions;
    today: string;
    deadlineAtMs: number;
}

/** 후보 보고서가 마감 전인지 후인지에 따른 "없음" TTL. */
const missingTtlFor = (
    candidate: Pick<KrReportCandidate, 'deadline'> | null,
    today: string
): number =>
    candidate !== null && today <= candidate.deadline
        ? KR_MISSING_BEFORE_DEADLINE_TTL_SECONDS
        : KR_MISSING_AFTER_DEADLINE_TTL_SECONDS;

async function loadStatements(
    ctx: LoadContext,
    corpCode: string,
    target: Pick<KrReportCandidate, 'year' | 'reportCode'> &
        Partial<Pick<KrReportCandidate, 'deadline'>>,
    fsDiv: DartFsDiv
): Promise<StatementFigures | null> {
    return getOrSetCache<StatementFigures | null>(
        statementsKey(corpCode, target.year, target.reportCode, fsDiv),
        ttlFor(
            missingTtlFor(
                target.deadline === undefined
                    ? null
                    : { deadline: target.deadline },
                ctx.today
            )
        ),
        async () => {
            ctx.budget.spend();
            const rows = await fetchFinancialStatementsAll(
                corpCode,
                target.year,
                target.reportCode,
                fsDiv,
                ctx.options
            );
            return rows === null
                ? null
                : extractStatementFigures(rows, {
                      year: target.year,
                      reportCode: target.reportCode,
                      fsDiv,
                  });
        }
    );
}

/** 연결 → 별도 순. 연결 재무제표가 없는(`013`) 회사만 별도를 쓴다. */
async function loadFirstAvailable(
    ctx: LoadContext,
    corpCode: string,
    target: Parameters<typeof loadStatements>[2],
    fsDivs: readonly DartFsDiv[]
): Promise<StatementFigures | null> {
    for (const fsDiv of fsDivs) {
        const found = await loadStatements(ctx, corpCode, target, fsDiv);
        if (found !== null) return found;
    }
    return null;
}

/** 결산일 시점 KRX 상장주식수 행(우선주 포함). 캐시한다 — 결산일이 정해지면 값이 바뀌지 않는다. */
async function loadKrxListedItems(
    ctx: LoadContext,
    prefix: string,
    periodEnd: string,
    timeoutMs: number
): Promise<KrxListedItem[] | null> {
    return getOrSetCache<KrxListedItem[] | null>(
        krxListedSharesKey(prefix, periodEnd),
        value =>
            value === null
                ? KRX_LISTED_SHARES_MISSING_TTL_SECONDS
                : KRX_LISTED_SHARES_TTL_SECONDS,
        async () => {
            const items = await fetchKrxListedItemsOnOrBefore(
                prefix,
                periodEnd.replaceAll('-', ''),
                timeoutMs
            );
            return items.length === 0 ? null : items;
        }
    );
}

/** 주식수와, 그것이 일시적 대체인지(KRX 갱신을 못 해 앞선 DART 표 그대로 쓴 경우). */
interface LoadedShares {
    shares: ShareTotals | null;
    transient: boolean;
}

/**
 * 주식 표가 보고서 기간 말보다 앞선 결산일의 것일 때(보고서 자신의 표가 비어 앞선 보고서로 내려왔다) KRX 상장주식수로 갱신한다.
 * DART 표를 그대로 돌려주는 것이 안전한 대체값이라 어떤 실패도 던지지 않는다(Next 동적 서버 오류만 제어 흐름이라 다시 던진다). 제공처(yahoo)
 * 값으로는 절대 내려가지 않는다. 다만 오류·타임아웃·시한 초과로 갱신을 못 한 결과는 낡은 주식수라 `transient`로 알린다 — 호출부가 장기 캐시에
 * 굳히지 않는다(SERVER.md#SA-18). 키 없음(설정)과 KRX가 그 기간에 행을 주지 않은 경우(1일 캐시된 빈 응답)는 다시 물어도 같아 `transient`가 아니다.
 * KRX 요청은 남은 시한으로 자른 타임아웃을 써서 바깥 시한이 먼저 터지지 않게 한다.
 */
async function refreshSharesFromKrx(
    ctx: LoadContext,
    symbol: string,
    dart: ShareTotals,
    year: number,
    reportCode: KrReportCode
): Promise<{ shares: ShareTotals; transient: boolean }> {
    if (!hasDataGoKrCredentials()) return { shares: dart, transient: false };
    const remainingMs = ctx.deadlineAtMs - Date.now();
    if (remainingMs <= 0) return { shares: dart, transient: true };
    try {
        const items = await loadKrxListedItems(
            ctx,
            symbol.toUpperCase().slice(0, 5),
            reportPeriodEnd(year, reportCode),
            Math.min(ctx.options.timeoutMs ?? remainingMs, remainingMs)
        );
        const krx = items === null ? null : toKrxShareCounts(items);
        if (krx === null) return { shares: dart, transient: false };
        const refreshed = refreshShareCounts(dart, krx);
        const change = refreshed.issued / dart.issued - 1;
        if (Math.abs(change) > SHARE_REFRESH_LOG_RATIO) {
            console.warn(
                '[kr-valuation] KRX share count moved the DART issued total by more than 20%:',
                symbol,
                `${(change * 100).toFixed(1)}%`
            );
        }
        return { shares: refreshed, transient: false };
    } catch (error) {
        if (isDynamicServerError(error)) throw error;
        console.warn(
            '[kr-valuation] KRX listed shares unavailable, using the DART share table:',
            symbol,
            redactDbErrorForLog(error)
        );
        return { shares: dart, transient: true };
    }
}

/**
 * 주식수 — 보고서 자신의 표가 채워져 있으면 그것을, 비어 있으면 가장 가까운 앞선 보고서의 표를 KRX 상장주식수로 갱신해 쓴다
 * (`shareReportOrder`, `refreshShareCounts`). 앞선 표를 그대로 쓰던 때는 그 사이의 증자·무상·분할·전환·소각이 빠져 알테오젠 PER·PBR이
 * 23% 어긋났다. 보고서 자신의 표가 비었다는 사실은 이미 공시된 보고서에서는 바뀌지 않아(호출부는 재무제표를 읽은 뒤에만 온다) 길게 캐시한다.
 */
async function loadShares(
    ctx: LoadContext,
    symbol: string,
    corpCode: string,
    year: number,
    reportCode: KrReportCode
): Promise<LoadedShares> {
    const order = shareReportOrder(year, reportCode);
    for (const [index, entry] of order.entries()) {
        const found = await getOrSetCache<ShareTotals | null>(
            stockTotalsKey(corpCode, entry.year, entry.reportCode),
            ttlFor(
                index === 0
                    ? FOUND_TTL_SECONDS
                    : KR_MISSING_AFTER_DEADLINE_TTL_SECONDS
            ),
            async () => {
                ctx.budget.spend();
                const rows = await fetchStockTotalQuantity(
                    corpCode,
                    entry.year,
                    entry.reportCode,
                    ctx.options
                );
                return rows === null ? null : extractShareTotals(rows);
            }
        );
        if (found === null) continue;
        return index === 0
            ? { shares: found, transient: false }
            : refreshSharesFromKrx(ctx, symbol, found, year, reportCode);
    }
    return { shares: null, transient: false };
}

async function loadFiscalYearMonth(
    ctx: LoadContext,
    corpCode: string
): Promise<string | null> {
    return getOrSetCache<string | null>(
        companyKey(corpCode),
        ttlFor(KR_MISSING_AFTER_DEADLINE_TTL_SECONDS),
        async () => {
            ctx.budget.spend();
            const info = await fetchCompanyInfo(corpCode, ctx.options);
            const month = info?.acc_mt;
            return typeof month === 'string' && month !== '' ? month : null;
        }
    );
}

/**
 * `transient`: 오류·시한·예산 때문에 못 읽었다(다시 읽으면 될 수 있다). 호출부는 이 값을 장기 캐시에 굳히지 않는다
 * (SERVER.md#SA-18). 키 없음·매핑 없음·보고서 없음·12월 결산 아님은 그 자체로 정해진 답이라 `transient`가 아니다.
 */
export type KrValuationLoad =
    | {
          kind: 'ok';
          data: Omit<KrValuationData, 'price'>;
          /** KRX 갱신을 못 해 낡은 주식수로 계산했다. 값은 DART 기준이지만 다시 읽으면 달라질 수 있다. */
          transient: boolean;
      }
    | {
          kind: 'fallback';
          reason: KrProviderFallbackReason;
          transient: boolean;
      };

const fallback = (
    reason: KrProviderFallbackReason,
    transient = false
): KrValuationLoad => ({ kind: 'fallback', reason, transient });

async function loadInputs(
    symbol: string,
    now: Date,
    ctx: LoadContext
): Promise<KrValuationLoad> {
    const corp = await getKrDartCorp(symbol);
    if (corp === null) return fallback('not_covered');

    const month = await loadFiscalYearMonth(ctx, corp.corpCode);
    if (month === null) return fallback('dart_unavailable');
    if (month !== DECEMBER_FISCAL_YEAR)
        return fallback('non_december_fiscal_year');

    for (const candidate of krReportCandidates(
        kstDateKey(now),
        MAX_REPORT_ATTEMPTS
    )) {
        const current = await loadFirstAvailable(
            ctx,
            corp.corpCode,
            candidate,
            FS_DIVS
        );
        if (current === null) continue;
        // 같은 재무제표 구분(연결/별도)으로 맞춘 직전 사업연도 — 구분이 섞이면 TTM이 두 기준의 합이 된다.
        const priorAnnual =
            current.reportCode === '11011'
                ? null
                : await loadFirstAvailable(
                      ctx,
                      corp.corpCode,
                      { year: current.year - 1, reportCode: '11011' },
                      [current.fsDiv]
                  );
        const { shares, transient } = await loadShares(
            ctx,
            symbol,
            corp.corpCode,
            current.year,
            current.reportCode
        );
        return {
            kind: 'ok',
            data: { current, priorAnnual, shares },
            transient,
        };
    }
    return fallback('no_report');
}

/** 프로세스 안에서 동시에 DART를 읽는 종목 수를 묶는 세마포어. */
const waiting: (() => void)[] = [];
let active = 0;

async function acquireSlot(): Promise<void> {
    if (active < KR_VALUATION_MAX_CONCURRENT) {
        active += 1;
        return;
    }
    // 슬롯 소유권을 대기자에게 넘기므로 `active`는 그대로다.
    await new Promise<void>(resolve => waiting.push(resolve));
}

function releaseSlot(): void {
    const next = waiting.shift();
    if (next === undefined) active -= 1;
    else next();
}

const TIMED_OUT = Symbol('kr-valuation-timeout');

/**
 * 한국 종목의 DART 입력(최신 정기보고서 숫자 + 직전 사업연도 + 주식수). 절대 던지지 않는다 — DART 키 없음·한도·IP·네트워크 오류·시한 초과는
 * 로그를 남기고 `fallback`으로 돌려 호출부가 제공처 값을 쓰게 한다(SERVER.md#SA-4). Next의 동적 서버 오류(제어 흐름)만 다시 던진다.
 * 호출 수·시한·예약은 위 "DART 호출 예산"과 `KrValuationMode`가 정한다.
 */
export async function getKrValuationInputs(
    symbol: string,
    now: Date = new Date(),
    mode: KrValuationMode = 'request'
): Promise<KrValuationLoad> {
    // E2E는 네트워크에 나가지 않는다 — DART 보고서 픽스처가 없으므로 제공처 값(가짜 provider)을 그대로 쓴다.
    if (isE2E() || !isDartEnabled()) return fallback('dart_unavailable');
    const policy = POLICY[mode];
    const deadlineAtMs = Date.now() + policy.deadlineMs;
    const ctx: LoadContext = {
        budget: new CallBudget(policy.maxCalls, deadlineAtMs),
        options: policy.request,
        today: kstDateKey(now),
        deadlineAtMs,
    };
    const guarded = async (): Promise<KrValuationLoad> => {
        await acquireSlot();
        try {
            // 줄에서 기다리는 동안 시한이 지났으면 DART는커녕 DB 조회(`getKrDartCorp`)도 시작하지 않고 슬롯을 바로 돌려준다.
            if (Date.now() >= deadlineAtMs)
                return fallback('dart_unavailable', true);
            return await loadInputs(symbol, now, ctx);
        } finally {
            releaseSlot();
        }
    };
    try {
        const result = await withTimeout<KrValuationLoad | typeof TIMED_OUT>(
            guarded(),
            policy.deadlineMs,
            TIMED_OUT
        );
        if (result === TIMED_OUT) {
            console.warn(
                '[kr-valuation] DART read passed its deadline, using provider values:',
                symbol
            );
            return fallback('dart_unavailable', true);
        }
        return result;
    } catch (error) {
        if (isDynamicServerError(error)) throw error;
        const failureKind = dartFatalReason(error) ?? 'request_failed';
        console.warn(
            '[kr-valuation] DART read failed, using provider values:',
            failureKind,
            redactDbErrorForLog(error)
        );
        return fallback('dart_unavailable', true);
    }
}
