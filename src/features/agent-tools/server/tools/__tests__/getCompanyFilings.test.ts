const { listFilings, readFiling } = vi.hoisted(() => ({
    listFilings: vi.fn(),
    readFiling: vi.fn(),
}));
vi.mock('@/entities/company-filings/server/getCompanyFilings', () => ({
    listCompanyFilings: listFilings,
    readCompanyFiling: readFiling,
}));

import {
    AGENT_FILING_TEXT_MAX_CHARS,
    AGENT_FILINGS_LIST_MAX,
} from '@y0ngha/siglens-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
    CompanyFiling,
    CompanyFilingBody,
} from '@/entities/company-filings/model';
import {
    COMPANY_FILINGS_RESULT_MAX_CHARS,
    TOOL_RESULT_MAX_CHARS,
    truncateToolResult,
} from '@/features/agent-tools/lib/truncate';
import { getCompanyFilingsTool } from '@/features/agent-tools/server/tools/getCompanyFilings';

const ctx = {
    userId: 'u',
    tier: 'member' as const,
    locale: 'ko' as const,
    signal: new AbortController().signal,
};
const rt = {
    analysisModel: 'deepseek-v4.1-flash' as const,
    ensureSymbolData: async (): Promise<void> => {},
};
const run = (args: Record<string, unknown>) =>
    getCompanyFilingsTool(args, ctx, rt);

const ACCESSION = '0001193125-26-461016';

function filing(over: Partial<CompanyFiling> = {}): CompanyFiling {
    return {
        accession: ACCESSION,
        form: '8-K',
        filedAt: '2026-11-13',
        items: [
            {
                code: '5.02',
                label: 'Departure or appointment of directors or officers',
            },
        ],
        headline: 'IonQ Announces Executive Leadership Evolution',
        hasPressRelease: true,
        url: 'https://www.sec.gov/Archives/edgar/data/1824920/000119312526461016/ionq-ex99_1.htm',
        ...over,
    };
}

function body(over: Partial<CompanyFilingBody> = {}): CompanyFilingBody {
    return {
        ...filing(),
        document: 'press_release',
        text: 'Release text.',
        truncated: false,
        totalChars: 13,
        ...over,
    };
}

beforeEach(() => {
    // 거부형 기본값: 명시하지 않은 호출은 테스트를 실패시킨다.
    listFilings.mockReset().mockRejectedValue(new Error('unexpected list'));
    readFiling.mockReset().mockRejectedValue(new Error('unexpected read'));
});

describe('get_company_filings: 목록 모드', () => {
    it('심볼을 대문자로 바꿔 목록을 돌려준다', async () => {
        listFilings.mockResolvedValue({
            status: 'ok',
            cik: '1824920',
            filings: [filing()],
        });
        const result = (await run({ symbol: 'ionq' })) as Record<
            string,
            unknown
        >;
        expect(listFilings).toHaveBeenCalledWith('IONQ');
        expect(result).toMatchObject({
            source: 'SEC EDGAR',
            symbol: 'IONQ',
            available: true,
            filings: [filing()],
        });
        expect(typeof result.asOf).toBe('string');
        expect(readFiling).not.toHaveBeenCalled();
    });

    it.each([
        ['undefined', undefined],
        ['빈 문자열', ''],
        ['공백', '   '],
        ['문자열이 아닌 값', 42],
        ['null', null],
    ])('accession이 %s이면 목록 모드', async (_label, accession) => {
        listFilings.mockResolvedValue({ status: 'ok', cik: '1', filings: [] });
        const result = await run({ symbol: 'IONQ', accession });
        expect(result).toMatchObject({ available: true, filings: [] });
        expect(readFiling).not.toHaveBeenCalled();
    });

    it('no_sec_filer와 failed를 available:false로 옮긴다', async () => {
        listFilings.mockResolvedValueOnce({ status: 'no_sec_filer' });
        expect(await run({ symbol: '005930.KS' })).toEqual({
            symbol: '005930.KS',
            available: false,
            reason: 'no_sec_filer',
        });
        listFilings.mockResolvedValueOnce({ status: 'failed' });
        expect(await run({ symbol: 'IONQ' })).toEqual({
            symbol: 'IONQ',
            available: false,
            reason: 'provider_failed',
        });
    });
});

describe('get_company_filings: 읽기 모드', () => {
    it('접수번호를 정규화해(대시 없음 허용) 본문을 돌려준다', async () => {
        readFiling.mockResolvedValue({ status: 'ok', filing: body() });
        const result = await run({
            symbol: 'ionq',
            accession: ` ${ACCESSION.replaceAll('-', '')} `,
        });
        expect(readFiling).toHaveBeenCalledWith('IONQ', ACCESSION);
        expect(result).toMatchObject({
            source: 'SEC EDGAR',
            symbol: 'IONQ',
            available: true,
            filing: body(),
        });
        expect(listFilings).not.toHaveBeenCalled();
    });

    it('접수번호 형식이 아니면 엔티티를 부르지 않고 unknown_filing', async () => {
        expect(await run({ symbol: 'IONQ', accession: 'garbage' })).toEqual({
            error: 'unknown_filing',
        });
        expect(readFiling).not.toHaveBeenCalled();
        expect(listFilings).not.toHaveBeenCalled();
    });

    it('목록에 없는 접수번호는 unknown_filing', async () => {
        readFiling.mockResolvedValue({ status: 'unknown_filing' });
        expect(await run({ symbol: 'IONQ', accession: ACCESSION })).toEqual({
            error: 'unknown_filing',
        });
    });

    it('no_sec_filer와 failed를 available:false로 옮긴다', async () => {
        readFiling.mockResolvedValueOnce({ status: 'no_sec_filer' });
        expect(await run({ symbol: 'BTCUSD', accession: ACCESSION })).toEqual({
            symbol: 'BTCUSD',
            available: false,
            reason: 'no_sec_filer',
        });
        readFiling.mockResolvedValueOnce({ status: 'failed' });
        expect(await run({ symbol: 'IONQ', accession: ACCESSION })).toEqual({
            symbol: 'IONQ',
            available: false,
            reason: 'provider_failed',
        });
    });
});

describe('get_company_filings: 결과 크기', () => {
    const LONG_LABEL_ITEMS = [
        ['1.01', 'Entry into a material agreement'],
        ['2.01', 'Completion of an acquisition or disposition of assets'],
        ['2.02', 'Results of operations and financial condition'],
        ['3.01', 'Notice of delisting or listing-rule failure'],
        ['3.03', 'Material modification to rights of security holders'],
        ['4.02', 'Non-reliance on previously issued financial statements'],
        ['5.02', 'Departure or appointment of directors or officers'],
        ['5.03', 'Amendments to articles or bylaws'],
    ].map(([code, label]) => ({ code, label }));

    /** 따옴표가 든 200자 제목. */
    const HEADLINE =
        `"${'Acme Corp. announces "record" quarter '.repeat(6)}`.slice(0, 200);

    function worstList(): CompanyFiling[] {
        return Array.from({ length: AGENT_FILINGS_LIST_MAX }, (_, i) =>
            filing({
                accession: `0001193125-26-46${String(1000 + i)}`.slice(0, 20),
                form: '8-K/A',
                filedAt: `2026-11-${String(13 - i).padStart(2, '0')}`,
                items: LONG_LABEL_ITEMS,
                headline: HEADLINE,
                url: `https://www.sec.gov/Archives/edgar/data/1824920/0001193125260461${String(i).padStart(3, '0')}/nvidiaannouncesceotransiti.htm`,
            })
        );
    }

    /** 12,000자, 12자마다 `"` 하나와 줄바꿈 하나(= 길이 +16.7%) — 실제 보도자료보다 이스케이프가 많은 최악. */
    function worstText(): string {
        const unit = 'abcdefghij"\n';
        return unit.repeat(AGENT_FILING_TEXT_MAX_CHARS / unit.length);
    }

    it('10건 목록의 최악(항목 8개·200자 제목)은 상한 안에서 잘리지 않는다', async () => {
        listFilings.mockResolvedValue({
            status: 'ok',
            cik: '1824920',
            filings: worstList(),
        });
        const result = await run({ symbol: 'ACME' });
        const size = JSON.stringify(result).length;
        expect(HEADLINE).toHaveLength(200);
        expect(size).toBeLessThan(COMPANY_FILINGS_RESULT_MAX_CHARS);
        expect(
            truncateToolResult(result, COMPANY_FILINGS_RESULT_MAX_CHARS)
        ).toBe(result);
        // 표준 상한(4,000자)으로는 부족하다 — 그래서 전용 상한이 있다.
        expect(size).toBeGreaterThan(TOOL_RESULT_MAX_CHARS);
    });

    it('AGENT_FILING_TEXT_MAX_CHARS 길이의 읽기 최악(이스케이프 많은 본문)은 상한 안에서 잘리지 않는다', async () => {
        const text = worstText();
        expect(text).toHaveLength(AGENT_FILING_TEXT_MAX_CHARS);
        readFiling.mockResolvedValue({
            status: 'ok',
            filing: body({
                items: LONG_LABEL_ITEMS,
                headline: HEADLINE,
                text,
                truncated: true,
                totalChars: 90_000,
            }),
        });
        const result = (await run({
            symbol: 'ACME',
            accession: ACCESSION,
        })) as { filing: CompanyFilingBody };
        const size = JSON.stringify(result).length;
        expect(size).toBeLessThan(COMPANY_FILINGS_RESULT_MAX_CHARS);
        expect(result.filing.text).toBe(text);
        expect(
            truncateToolResult(result, COMPANY_FILINGS_RESULT_MAX_CHARS)
        ).toBe(result);
    });

    it('상한을 넘는 본문(전부 따옴표)은 본문을 줄여 truncated로 돌려주고 미리보기 덩어리로 무너지지 않는다', async () => {
        readFiling.mockResolvedValue({
            status: 'ok',
            filing: body({
                text: '"'.repeat(AGENT_FILING_TEXT_MAX_CHARS),
                truncated: false,
                totalChars: AGENT_FILING_TEXT_MAX_CHARS,
            }),
        });
        const result = (await run({
            symbol: 'ACME',
            accession: ACCESSION,
        })) as { filing: CompanyFilingBody; available: boolean };
        expect(JSON.stringify(result).length).toBeLessThanOrEqual(
            COMPANY_FILINGS_RESULT_MAX_CHARS
        );
        expect(result.available).toBe(true);
        expect(result.filing.truncated).toBe(true);
        expect(result.filing.text.length).toBeGreaterThan(0);
        expect(result.filing.text.length).toBeLessThan(
            AGENT_FILING_TEXT_MAX_CHARS
        );
        expect(
            truncateToolResult(result, COMPANY_FILINGS_RESULT_MAX_CHARS)
        ).toBe(result);
    });
});
