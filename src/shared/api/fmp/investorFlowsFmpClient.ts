import { fmpGet } from './httpClient';
import { isRenderBudgetActive } from '@/shared/lib/renderBudget';
import {
    fetchSubmissionsJson,
    submissionsFileName,
} from '@/shared/api/sec/secClient';
import {
    accessionFromFilingUrl,
    indexSubmissions,
    indexSubmissionsFile,
} from './largeHolderForms';
import type {
    InvestorFlowsFmpProvider,
    RawBeneficialOwnership,
    RawInsiderStatistic,
    RawInsiderTrade,
    RawSharesFloat,
} from './investorFlowsProvider.types';
import { MS_PER_DAY } from '@/shared/config/time';
import { toUtcIsoDate } from '@/shared/lib/isoDate';

/** FMP `insider-trading/search`의 페이지 크기. 한 페이지가 가득 차야 다음 페이지가 있을 수 있다. */
export const INSIDER_PAGE_SIZE = 200;

/**
 * 배치 경로 페이지 상한(렌더 경로는 `INSIDER_RENDER_MAX_PAGES`) — 거래가 아주 많은 종목이 호출 수를 무한정 키우지 못하게 한다. 상한에 닿으면 가장 오래된
 * 행이 잘릴 뿐 최신 행은 모두 들어 있다(결과가 최신순이다).
 *
 * 2026-10 실측: FMP는 `limit`을 1,000으로 자른다(2,000을 줘도 1,000행). 1,000행은 AAPL 기준 ~600KB(8년치)라
 * 12개월 창에는 과하다 — 페이지 200행(~120KB)으로 받고, 대부분 종목은 1~3페이지에 창을 덮는다.
 * 200행 × 100페이지 = 2만 행이면 어떤 종목의 12개월도 넘치므로 100은 안전 상한일 뿐 평소엔 닿지 않는다.
 */
/**
 * 렌더 경로 내부자 거래 페이지네이션: 페이지 상한과 전체 시간(ms). 깊은 페이지네이션은 배치에서만 한다. 이 상수는
 * 클라이언트(shared)가 쓰므로 entities 정책 파일이 아니라 여기에 둔다(shared는 entities를 import할 수 없다).
 */
export const INSIDER_RENDER_MAX_PAGES = 5;
export const INSIDER_RENDER_BUDGET_MS = 6_000;

export const INSIDER_MAX_PAGES = 100;

/**
 * FMP adapter implementing `InvestorFlowsFmpProvider`.
 *
 * No error catch: `fmpGet` surfaces `FmpHttpError`, and the caller must be able to tell an
 * infrastructure failure (throw) from "no rows" (`[]`) — see `InvestorFlowsFmpProvider`.
 */
/** 13D/G 양식 조회가 열어 볼 보조 제출 파일 수 상한(호출 폭주 방지). */
const MAX_EXTRA_SUBMISSION_FILES = 2;

type FetchSubmissions = (fileName: string) => Promise<unknown | null>;

export class FmpInvestorFlowsClient implements InvestorFlowsFmpProvider {
    constructor(
        private readonly fetchSubmissions: FetchSubmissions = fetchSubmissionsJson
    ) {}

    /**
     * 최신 공시순(`filingDate` 내림차순)으로 페이지를 넘기다가 `lookbackDays`보다 오래된 공시가
     * 나오거나, 페이지가 비거나, 가득 차지 않았거나, 페이지 상한이 되면 멈춘다.
     */
    async getInsiderTrades(
        symbol: string,
        lookbackDays: number
    ): Promise<RawInsiderTrade[]> {
        const cutoff = toUtcIsoDate(
            new Date(Date.now() - lookbackDays * MS_PER_DAY)
        );
        const upper = symbol.toUpperCase();
        const rows: RawInsiderTrade[] = [];
        // 렌더 경로(ISR 재생성)는 얕게·짧게: 페이지 `INSIDER_RENDER_MAX_PAGES`와 전체 `INSIDER_RENDER_BUDGET_MS`.
        // 깊은 페이지네이션은 배치(크론·프리웜)에서만 한다. 예산을 넘기면 지금까지 받은 최신 행으로 끝낸다(가장
        // 오래된 행이 잘릴 뿐이다 — 결과가 최신순이라 최근 활동은 모두 들어 있다).
        const inRender = isRenderBudgetActive();
        const maxPages = inRender
            ? INSIDER_RENDER_MAX_PAGES
            : INSIDER_MAX_PAGES;
        const startedAt = Date.now();
        for (let page = 0; page < maxPages; page++) {
            if (
                inRender &&
                page > 0 &&
                Date.now() - startedAt >= INSIDER_RENDER_BUDGET_MS
            ) {
                console.warn(
                    '[investor-flows] insider pagination cut short on the render path'
                );
                break;
            }
            // 다음 페이지 요청 여부가 이전 페이지 내용에 달려 있어 직렬이어야 한다.
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            const raw = await fmpGet<RawInsiderTrade[]>(
                'insider-trading/search',
                {
                    symbol: upper,
                    page: String(page),
                    limit: String(INSIDER_PAGE_SIZE),
                }
            );
            if (!Array.isArray(raw) || raw.length === 0) break;
            rows.push(
                ...raw.filter(
                    row =>
                        typeof row.filingDate === 'string' &&
                        row.filingDate.slice(0, cutoff.length) >= cutoff
                )
            );
            const oldest = raw[raw.length - 1]?.filingDate;
            if (
                raw.length < INSIDER_PAGE_SIZE ||
                (typeof oldest === 'string' && oldest < cutoff)
            ) {
                break;
            }
        }
        return rows;
    }

    async getInsiderStatistics(symbol: string): Promise<RawInsiderStatistic[]> {
        const raw = await fmpGet<RawInsiderStatistic[]>(
            'insider-trading/statistics',
            { symbol: symbol.toUpperCase() }
        );
        return Array.isArray(raw) ? raw : [];
    }

    async getBeneficialOwnership(
        symbol: string,
        limit: number
    ): Promise<RawBeneficialOwnership[]> {
        const raw = await fmpGet<RawBeneficialOwnership[]>(
            'acquisition-of-beneficial-ownership',
            { symbol: symbol.toUpperCase(), limit: String(limit) }
        );
        return Array.isArray(raw) ? this.attachForms(raw) : [];
    }

    /**
     * 각 행의 정확한 양식(`/A` 포함)을 피공시 회사의 SEC 제출 목록에서 찾아 `form`에 단다 — 심볼당 SEC 호출 1회
     * (`filings.recent`로 안 덮이는 오래된 행이 있을 때만 보조 파일을 최대 2개 더). 조회가 실패하면 던지지 않고
     * 못 찾은 행에 `formLookupFailed`를 달아 매퍼가 URL 추정으로 대체하게 한다 — 양식은 부가 정보라 13D/G 전체를
     * 못 쓰게 만들 이유가 없다. 목록에서 accession을 못 찾은 행은 `form` 없이(= 모호) 둔다.
     */
    private async attachForms(
        rows: RawBeneficialOwnership[]
    ): Promise<RawBeneficialOwnership[]> {
        if (rows.length === 0) return rows;
        const cik = rows.find(row => row.cik)?.cik;
        const forms = new Map<string, string>();
        let failed = false;
        if (!cik) {
            failed = true;
        } else {
            try {
                const first = indexSubmissions(
                    await this.fetchSubmissions(submissionsFileName(cik))
                );
                for (const [accession, form] of first.forms)
                    forms.set(accession, form);
                const unresolvedDates = rows
                    .filter(
                        row => !forms.has(accessionFromFilingUrl(row.url) ?? '')
                    )
                    .map(row => row.filingDate?.slice(0, 10))
                    .filter((d): d is string => typeof d === 'string')
                    .sort();
                const oldestNeeded = unresolvedDates[0];
                if (
                    oldestNeeded !== undefined &&
                    first.oldestFilingDate !== null &&
                    first.oldestFilingDate > oldestNeeded
                ) {
                    const extra = [...first.extraFiles]
                        .filter(file => file.filingTo >= oldestNeeded)
                        .sort((a, b) => (a.filingTo < b.filingTo ? 1 : -1))
                        .slice(0, MAX_EXTRA_SUBMISSION_FILES);
                    for (const file of extra) {
                        // 파일 수가 적고 SEC 게이트가 속도를 정한다 — 직렬.
                        // react-doctor-disable-next-line react-doctor/async-await-in-loop
                        const json = await this.fetchSubmissions(file.name);
                        for (const [accession, form] of indexSubmissionsFile(
                            json
                        ).forms) {
                            forms.set(accession, form);
                        }
                    }
                }
            } catch (error) {
                failed = true;
                console.warn(
                    '[investor-flows] SEC submissions lookup failed:',
                    error
                );
            }
        }
        return rows.map(row => {
            const form = forms.get(accessionFromFilingUrl(row.url) ?? '');
            if (form !== undefined) return { ...row, form };
            return failed ? { ...row, formLookupFailed: true } : row;
        });
    }

    async getSharesFloat(symbol: string): Promise<RawSharesFloat | null> {
        const raw = await fmpGet<RawSharesFloat[]>('shares-float', {
            symbol: symbol.toUpperCase(),
        });
        return Array.isArray(raw) && raw.length > 0 ? (raw[0] ?? null) : null;
    }
}
