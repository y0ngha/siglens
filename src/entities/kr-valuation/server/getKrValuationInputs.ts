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
    type KrReportCandidate,
} from '../lib/krReportCandidates';
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
 * - **한 종목, 캐시가 비었을 때**: 기업 개황 1 + 최신 보고서 1(연결이 없는 회사는 별도까지 2) + 직전 사업연도 1 + 주식 표 1~2 = 4~5회.
 *   공시 창이 열린 보고서가 아직 안 올라왔으면 그 후보마다 연결·별도 2회가 더 든다. 요청 경로는 한 종목당 6회까지만 쓰고
 *   (`REQUEST_PATH`), 넘으면 제공처 값으로 내려간다. 배경(프리웜)은 10회(후보 3개를 모두 헛짚는 최악).
 * - **캐시가 찼을 때**: 0회. 찾은 값은 30일, 없는 값은 마감 전 3일·마감 후 7일(`KR_MISSING_*`)이다.
 *   헛짚는 후보도 마감 3주 전(`krReportCandidates`)부터만 묻는다 — 기간 말 직후부터 묻던 때의 45일 매일 1회가 21일 3일에 1회로 준다.
 * - **하루 최악(상장 약 2,600종목 가정)**: 전 종목이 한꺼번에 비어도 종목당 4~5회라 약 1만 2천 회이고, 그 전에 `KR_VALUATION_RESERVE`가
 *   일일 예산(19,000)에서 6,000을 크론 몫으로 남겨 두므로 이 모듈은 카운터가 약 13,000에 닿으면 멈춘다(근사: 예약선을 읽고 증가시키는 사이에 진행 중이던 호출만큼, 즉 4 × 인스턴스 수 이하로 넘을 수 있다 — `reserveCall`). 평소(캐시가 30일에 걸쳐 돌아가는 정상 상태)는
 *   약 2,600 × 5 ÷ 30 ≈ 430회에 마감 전 3주의 헛짚기 ≤ 870회(2,600 ÷ 3)가 더해진다. 크론의 실제 일일 사용량은 이 모듈이 재지 않는다 —
 *   예약량은 보수적으로 잡은 값이다.
 * - **동시성**: 프로세스당 `KR_VALUATION_MAX_CONCURRENT`개 종목만 동시에 DART를 읽는다(프리웜이 몰려도 요청 경로의 호출이 줄 뒤로 밀리지 않도록
 *   요청 경로의 전체 시한이 대기 시간도 센다).
 */

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
 * - `request`: 화면 렌더·에이전트 도구. 요청 하나 2.5초, 재시도 없음, 종목당 6회, 전체 5초. 시한을 넘기면 제공처 값으로 내려간다.
 * - `background`: SEO 프리웜 등 기다리는 사람이 없는 경로. 크론 기본 옵션(30초·재시도 1회), 종목당 10회, 전체 2분.
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
        maxCalls: 6,
        deadlineMs: 5_000,
    },
    background: {
        request: {
            timeoutMs: DART_REQUEST_TIMEOUT_MS,
            maxRetries: DART_MAX_RETRIES,
            reserve: KR_VALUATION_RESERVE,
        },
        maxCalls: 10,
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
): string => `dart:stock-totqy:v1:${corpCode}:${year}:${reportCode}`;

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

async function loadShares(
    ctx: LoadContext,
    corpCode: string,
    year: number,
    reportCode: KrReportCode
): Promise<ShareTotals | null> {
    for (const entry of shareReportOrder(year, reportCode)) {
        const found = await getOrSetCache<ShareTotals | null>(
            stockTotalsKey(corpCode, entry.year, entry.reportCode),
            ttlFor(KR_MISSING_AFTER_DEADLINE_TTL_SECONDS),
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
        if (found !== null) return found;
    }
    return null;
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
    | { kind: 'ok'; data: Omit<KrValuationData, 'price'> }
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
        const shares = await loadShares(
            ctx,
            corp.corpCode,
            current.year,
            current.reportCode
        );
        return { kind: 'ok', data: { current, priorAnnual, shares } };
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
