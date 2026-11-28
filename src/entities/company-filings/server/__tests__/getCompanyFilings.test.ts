const sec = vi.hoisted(() => ({
    fetchSubmissionsJson: vi.fn(),
    fetchFilingIndexJson: vi.fn(),
    fetchFilingDocumentHead: vi.fn(),
}));
// 오류 클래스는 실물이 아니라 같은 이름의 대역이다(실물 secClient는 설정 모듈을 끌어와 목과 충돌한다).
const secErrors = vi.hoisted(() => ({
    SecSlotTimeoutError: class SecSlotTimeoutError extends Error {},
    SecBodyTimeoutError: class SecBodyTimeoutError extends Error {
        constructor(readonly kind: 'idle' | 'budget') {
            super(`body ${kind}`);
        }
    },
}));
const db = vi.hoisted(() => ({
    findCikBySymbol: vi.fn(),
    getDatabaseClient: vi.fn(),
    constructed: vi.fn(),
}));
const cache = vi.hoisted(() => ({
    store: new Map<string, unknown>(),
    writes: [] as { key: string; ttl: number }[],
}));
const e2e = vi.hoisted(() => ({ fake: false }));
const profile = vi.hoisted(() => ({ resolve: vi.fn() }));
const HEAD_CAP = vi.hoisted(() => 262_144);

vi.mock('@/shared/api/sec/secClient', () => ({
    SecSlotTimeoutError: secErrors.SecSlotTimeoutError,
    SecBodyTimeoutError: secErrors.SecBodyTimeoutError,
    fetchSubmissionsJson: sec.fetchSubmissionsJson,
    fetchFilingIndexJson: sec.fetchFilingIndexJson,
    fetchFilingDocumentHead: sec.fetchFilingDocumentHead,
    submissionsFileName: (cik: string) => `CIK${cik.padStart(10, '0')}.json`,
    filingFolderUrl: (cik: string, accession: string) =>
        `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replaceAll('-', '')}`,
    isSecBlockedError: (error: unknown) =>
        error instanceof Error && error.name === 'SecHttpError',
}));
vi.mock('@/entities/investor-flows/api/investorFlowsFilingsRepository', () => ({
    DrizzleSecFilingsRepository: vi.fn(function () {
        db.constructed();
        return { findCikBySymbol: db.findCikBySymbol };
    }),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: db.getDatabaseClient,
}));
vi.mock('@/entities/ticker/lib/resolveMarketProfile', () => ({
    resolveMarketProfile: profile.resolve,
}));
vi.mock('@/shared/config/investorFlows', () => ({
    SEC_FILING_HEAD_MAX_BYTES: HEAD_CAP,
}));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2EFakeMode: () => e2e.fake }));
vi.mock('@/shared/cache/getOrSetCache', () => ({
    getOrSetCache: async (
        key: string,
        ttl: number,
        fetcher: () => Promise<unknown>,
        shouldCache: (value: unknown) => boolean = () => true
    ) => {
        if (cache.store.has(key)) return cache.store.get(key);
        const value = await fetcher();
        if (shouldCache(value)) {
            cache.store.set(key, value);
            cache.writes.push({ key, ttl });
        }
        return value;
    },
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    AGENT_FILINGS_LIST_MAX,
    AGENT_FILING_TEXT_MAX_CHARS,
} from '@/entities/company-filings/lib/companyFilingsConstants';
import {
    FILING_META_LOAD_MAX,
    FILING_PUBLICATION_WINDOW_MS,
    listCompanyFilings,
    readCompanyFiling,
} from '@/entities/company-filings/server/getCompanyFilings';
import { MS_PER_DAY, SECONDS_PER_DAY } from '@/shared/config/time';
const { SecBodyTimeoutError, SecSlotTimeoutError } = secErrors;

const FOLDER = 'https://www.sec.gov/Archives/edgar/data/1824920';

/** 접수번호 0001193125-26-4610NN, NN = 00(최신)…11. 날짜는 11-13에서 하루씩 과거로. */
function accessionOf(n: number): string {
    return `0001193125-26-4610${String(n).padStart(2, '0')}`;
}
const ROW_COUNT = 12;

function submissions(overrides: Record<string, unknown[]> = {}) {
    const rows = Array.from({ length: ROW_COUNT }, (_, n) => n);
    return {
        filings: {
            recent: {
                form: rows.map(() => '8-K'),
                filingDate: rows.map(
                    n => `2026-11-${String(13 - n).padStart(2, '0')}`
                ),
                accessionNumber: rows.map(accessionOf),
                primaryDocument: rows.map(n => `main${n}.htm`),
                items: rows.map(() => '2.02,9.01'),
                ...overrides,
            },
        },
    };
}

function indexJson(n: number) {
    return {
        directory: {
            item: [
                { name: `${accessionOf(n)}-index.html`, size: '' },
                { name: `main${n}.htm`, size: '57111' },
                { name: `ex5_${n}.htm`, size: '24184' },
                { name: `x-ex99_1.htm`, size: '26100' },
            ],
        },
    };
}

function pressRelease(n: number): string {
    return `<html><head><title>x-ex99_1.htm</title></head><body><p>EX-99.1</p><p>Exhibit 99.1</p><p>Headline number ${n} announces results</p><p>●Body text of release ${n}.</p></body></html>`;
}

function indexOfAccession(accession: string): number {
    return Number(accession.slice(-2));
}

function happyPath(): void {
    db.getDatabaseClient.mockReturnValue({ db: {} });
    db.findCikBySymbol.mockResolvedValue(1824920);
    sec.fetchSubmissionsJson.mockResolvedValue(submissions());
    sec.fetchFilingIndexJson.mockImplementation(
        async (_cik: string, accession: string) =>
            indexJson(indexOfAccession(accession))
    );
    sec.fetchFilingDocumentHead.mockImplementation(
        async (_cik: string, accession: string) =>
            pressRelease(indexOfAccession(accession))
    );
}

function blockedError(): Error {
    const error = new Error('SEC 429');
    error.name = 'SecHttpError';
    return error;
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-15T17:00:00Z'));
    cache.store.clear();
    cache.writes.length = 0;
    e2e.fake = false;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // 거부형 기본값: 테스트가 명시하지 않은 SEC·DB 호출은 실패로 드러난다.
    const reject = () => Promise.reject(new Error('unexpected call'));
    sec.fetchSubmissionsJson.mockReset().mockImplementation(reject);
    sec.fetchFilingIndexJson.mockReset().mockImplementation(reject);
    sec.fetchFilingDocumentHead.mockReset().mockImplementation(reject);
    profile.resolve.mockReset().mockResolvedValue('us-equity');
    db.findCikBySymbol.mockReset().mockImplementation(reject);
    db.getDatabaseClient.mockReset().mockImplementation(() => {
        throw new Error('unexpected db');
    });
    db.constructed.mockReset();
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

function secCallCount(): number {
    return (
        sec.fetchSubmissionsJson.mock.calls.length +
        sec.fetchFilingIndexJson.mock.calls.length +
        sec.fetchFilingDocumentHead.mock.calls.length
    );
}

describe('심볼 → SEC 제출자 판정', () => {
    it('E2E fake 모드는 DB도 SEC도 건드리지 않는다', async () => {
        e2e.fake = true;
        expect(await listCompanyFilings('IONQ')).toEqual({
            status: 'no_sec_filer',
        });
        expect(await readCompanyFiling('IONQ', accessionOf(0))).toEqual({
            status: 'no_sec_filer',
        });
        expect(db.getDatabaseClient).not.toHaveBeenCalled();
        expect(secCallCount()).toBe(0);
    });

    it.each(['005930.KS', '035720.KQ'])(
        '한국 종목 %s은 DB 조회 없이 no_sec_filer',
        async symbol => {
            expect(await listCompanyFilings(symbol)).toEqual({
                status: 'no_sec_filer',
            });
            expect(await readCompanyFiling(symbol, accessionOf(0))).toEqual({
                status: 'no_sec_filer',
            });
            expect(db.getDatabaseClient).not.toHaveBeenCalled();
            expect(db.constructed).not.toHaveBeenCalled();
            expect(secCallCount()).toBe(0);
        }
    );

    it('크립토(시장 프로필)는 CIK 조회 없이 no_sec_filer', async () => {
        profile.resolve.mockResolvedValue('crypto');
        expect(await listCompanyFilings('BTCUSD')).toEqual({
            status: 'no_sec_filer',
        });
        expect(await readCompanyFiling('BTCUSD', accessionOf(0))).toEqual({
            status: 'no_sec_filer',
        });
        expect(db.findCikBySymbol).not.toHaveBeenCalled();
        expect(secCallCount()).toBe(0);
    });

    it('미국 주식인데 CIK 맵에 없으면 no_sec_filer가 아니라 failed(조회의 구멍)이고 심볼을 warn으로 남긴다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        db.getDatabaseClient.mockReturnValue({ db: {} });
        db.findCikBySymbol.mockResolvedValue(null);
        expect(await listCompanyFilings('NEWCO')).toEqual({ status: 'failed' });
        expect(await readCompanyFiling('NEWCO', accessionOf(0))).toEqual({
            status: 'failed',
        });
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('CIK map'),
            'NEWCO'
        );
        expect(secCallCount()).toBe(0);
    });

    it('시장 프로필 해석이 실패하면 failed', async () => {
        profile.resolve.mockRejectedValue(new Error('db down'));
        expect(await listCompanyFilings('IONQ')).toEqual({ status: 'failed' });
    });

    it('DB가 실패하면 failed(던지지 않는다)', async () => {
        db.getDatabaseClient.mockReturnValue({ db: {} });
        db.findCikBySymbol.mockRejectedValue(new Error('secret SQL params'));
        expect(await listCompanyFilings('IONQ')).toEqual({ status: 'failed' });
        expect(await readCompanyFiling('IONQ', accessionOf(0))).toEqual({
            status: 'failed',
        });
        // 오류 메시지는 로그에도 남기지 않는다.
        expect(
            JSON.stringify(vi.mocked(console.error).mock.calls)
        ).not.toContain('secret SQL params');
    });

    it('CIK를 소문자 심볼이 아니라 대문자로 조회한다', async () => {
        happyPath();
        await listCompanyFilings('ionq');
        expect(db.findCikBySymbol).toHaveBeenCalledWith('IONQ');
    });
});

describe('listCompanyFilings', () => {
    it('최신 AGENT_FILINGS_LIST_MAX건을 최신순으로, 제목·보도자료 여부·URL과 함께 돌려준다', async () => {
        happyPath();
        const result = await listCompanyFilings('IONQ');
        if (result.status !== 'ok') throw new Error('expected ok');
        expect(result.filings).toHaveLength(AGENT_FILINGS_LIST_MAX);
        expect(result.filings[0]).toEqual({
            accession: accessionOf(0),
            form: '8-K',
            filedAt: '2026-11-13',
            items: [
                {
                    code: '2.02',
                    label: 'Results of operations and financial condition',
                },
            ],
            headline: 'Headline number 0 announces results',
            hasPressRelease: true,
            url: `${FOLDER}/${accessionOf(0).replaceAll('-', '')}/x-ex99_1.htm`,
        });
        expect(result.filings.map(f => f.filedAt)).toEqual(
            result.filings
                .map(f => f.filedAt)
                .toSorted()
                .toReversed()
        );
    });

    it('차가운 호출은 SEC 요청 13건(제출 목록 1 + 최신 6건 × 색인·문서 앞부분 2)이고 요청 경로 옵션을 넘긴다', async () => {
        happyPath();
        await listCompanyFilings('IONQ');
        expect(sec.fetchSubmissionsJson).toHaveBeenCalledTimes(1);
        expect(sec.fetchSubmissionsJson).toHaveBeenCalledWith(
            'CIK0001824920.json'
        );
        expect(sec.fetchFilingIndexJson).toHaveBeenCalledTimes(6);
        expect(sec.fetchFilingDocumentHead).toHaveBeenCalledTimes(6);
        expect(secCallCount()).toBe(13);
        const options = {
            maxRetries: 0,
            timeoutMs: 6_000,
            totalBudgetMs: 8_000,
        };
        for (const call of sec.fetchFilingIndexJson.mock.calls)
            expect(call[2]).toEqual(options);
        for (const call of sec.fetchFilingDocumentHead.mock.calls)
            expect(call[3]).toEqual(options);
    });

    it('캐시 키·TTL: 목록 30분, 공시별 메타 30일', async () => {
        happyPath();
        await listCompanyFilings('IONQ');
        const list = cache.writes.find(
            w => w.key === 'sec:filings-list:v1:1824920'
        );
        expect(list?.ttl).toBe(1800);
        const meta = cache.writes.find(
            w => w.key === `sec:filing-meta:v2:${accessionOf(3)}`
        );
        expect(meta?.ttl).toBe(2_592_000);
        const text = cache.writes.find(
            w => w.key === `sec:filing-text:v3:${accessionOf(3)}`
        );
        expect(text?.ttl).toBe(2_592_000);
        // 목록 1 + 메타 6 + 본문 6
        expect(cache.writes).toHaveLength(1 + 6 + 6);
        // 일곱 번째 공시부터는 아무것도 읽지 않는다.
        expect(cache.writes.some(w => w.key.endsWith(accessionOf(6)))).toBe(
            false
        );
    });

    it('최신 6건 밖의 공시도 목록에는 나오지만 제목·보도자료 없이 주 문서 URL이다', async () => {
        happyPath();
        const result = await listCompanyFilings('IONQ');
        if (result.status !== 'ok') throw new Error('expected ok');
        expect(result.filings).toHaveLength(AGENT_FILINGS_LIST_MAX);
        expect(result.filings[5].headline).not.toBeNull();
        expect(result.filings[6]).toMatchObject({
            accession: accessionOf(6),
            headline: null,
            hasPressRelease: false,
            url: `${FOLDER}/${accessionOf(6).replaceAll('-', '')}/main6.htm`,
        });
        expect(
            sec.fetchFilingIndexJson.mock.calls.some(
                c => c[1] === accessionOf(6)
            )
        ).toBe(false);
    });

    it('두 번째 호출은 캐시로 끝나 SEC를 부르지 않는다', async () => {
        happyPath();
        await listCompanyFilings('IONQ');
        const before = secCallCount();
        const second = await listCompanyFilings('IONQ');
        expect(second.status).toBe('ok');
        expect(secCallCount()).toBe(before);
    });

    it('한 공시의 메타가 실패해도 목록에 남고(headline null, 주 문서 URL), 그 실패는 캐시되지 않는다', async () => {
        happyPath();
        const failing = accessionOf(2);
        sec.fetchFilingIndexJson.mockImplementation(
            async (_cik: string, accession: string) => {
                if (accession === failing) throw new Error('boom');
                return indexJson(indexOfAccession(accession));
            }
        );
        const result = await listCompanyFilings('IONQ');
        if (result.status !== 'ok') throw new Error('expected ok');
        expect(result.filings).toHaveLength(10);
        expect(result.filings[2]).toMatchObject({
            accession: failing,
            headline: null,
            hasPressRelease: false,
            url: `${FOLDER}/${failing.replaceAll('-', '')}/main2.htm`,
        });
        expect(result.filings[3].headline).not.toBeNull();
        expect(cache.store.has(`sec:filing-meta:v2:${failing}`)).toBe(false);

        // 다음 호출에서 복구된 공시만 다시 읽는다.
        sec.fetchFilingIndexJson.mockClear();
        sec.fetchFilingIndexJson.mockImplementation(
            async (_cik: string, accession: string) =>
                indexJson(indexOfAccession(accession))
        );
        const again = await listCompanyFilings('IONQ');
        if (again.status !== 'ok') throw new Error('expected ok');
        expect(again.filings[2].headline).toBe(
            'Headline number 2 announces results'
        );
        expect(sec.fetchFilingIndexJson.mock.calls.map(c => c[1])).toEqual([
            failing,
        ]);
    });

    it('문서 앞부분을 못 읽어도(null) 그 공시만 headline null', async () => {
        happyPath();
        sec.fetchFilingDocumentHead.mockImplementation(
            async (_cik: string, accession: string) =>
                accession === accessionOf(1)
                    ? null
                    : pressRelease(indexOfAccession(accession))
        );
        const result = await listCompanyFilings('IONQ');
        if (result.status !== 'ok') throw new Error('expected ok');
        expect(result.filings[1].headline).toBeNull();
        expect(result.filings[0].headline).not.toBeNull();
    });

    it('SEC가 색인 요청을 막으면 같은 호출의 문서 앞부분 요청을 더 보내지 않는다', async () => {
        happyPath();
        sec.fetchFilingIndexJson.mockRejectedValue(blockedError());
        const result = await listCompanyFilings('IONQ');
        if (result.status !== 'ok') throw new Error('expected ok');
        expect(result.filings.every(f => f.headline === null)).toBe(true);
        expect(sec.fetchFilingDocumentHead).not.toHaveBeenCalled();
    });

    it('SEC가 제출 목록 요청을 막으면 failed이고 캐시하지 않는다', async () => {
        happyPath();
        sec.fetchSubmissionsJson.mockRejectedValue(blockedError());
        expect(await listCompanyFilings('IONQ')).toEqual({ status: 'failed' });
        expect(cache.store.size).toBe(0);
        expect(sec.fetchFilingIndexJson).not.toHaveBeenCalled();
    });

    it.each([
        ['null(없는 파일)', null],
        ['filings.recent 없는 JSON', { filings: {} }],
        ['문자열', 'oops'],
    ])(
        '제출 목록이 %s이면 failed이고 빈 목록을 캐시하지 않는다',
        async (_label, json) => {
            happyPath();
            sec.fetchSubmissionsJson.mockResolvedValue(json);
            expect(await listCompanyFilings('IONQ')).toEqual({
                status: 'failed',
            });
            expect(cache.store.size).toBe(0);
        }
    );

    it('창 안에 공시가 없으면 빈 목록(ok)이다', async () => {
        happyPath();
        sec.fetchSubmissionsJson.mockResolvedValue(
            submissions({ filingDate: Array(ROW_COUNT).fill('2025-01-02') })
        );
        expect(await listCompanyFilings('IONQ')).toEqual({
            status: 'ok',
            filings: [],
            headlinesPending: false,
        });
        expect(sec.fetchFilingIndexJson).not.toHaveBeenCalled();
    });

    it('6-K 해외 발행인: 항목 없이, 색인의 ex99 첨부 제목을 쓴다', async () => {
        happyPath();
        sec.fetchSubmissionsJson.mockResolvedValue({
            filings: {
                recent: {
                    form: ['6-K'],
                    filingDate: ['2026-10-27'],
                    accessionNumber: ['0001213900-26-120000'],
                    primaryDocument: ['ea0309878-6k_sealsq.htm'],
                    items: [''],
                },
            },
        });
        sec.fetchFilingIndexJson.mockResolvedValue({
            directory: {
                item: [
                    { name: 'ea0309878-6k_sealsq.htm', size: '9000' },
                    { name: 'ea030987801ex99-1.htm', size: '30000' },
                    { name: 'img1.jpg', size: '1' },
                ],
            },
        });
        sec.fetchFilingDocumentHead.mockResolvedValue(
            '<p>PRESS RELEASE OF SEALSQ CORP ISSUED ON OCTOBER 27, 2026</p><p>Exhibit 99.1</p><p>SEALSQ QS7001 V1 Successfully Completes Evaluation</p>'
        );
        const result = await listCompanyFilings('LAES');
        if (result.status !== 'ok') throw new Error('expected ok');
        expect(result.filings).toEqual([
            {
                accession: '0001213900-26-120000',
                form: '6-K',
                filedAt: '2026-10-27',
                items: [],
                headline: 'SEALSQ QS7001 V1 Successfully Completes Evaluation',
                hasPressRelease: true,
                url: `https://www.sec.gov/Archives/edgar/data/1824920/000121390026120000/ea030987801ex99-1.htm`,
            },
        ]);
    });

    it('보도자료가 없는 8-K는 주 문서의 첫 Item 본문 첫 문장을 쓴다', async () => {
        happyPath();
        sec.fetchFilingIndexJson.mockResolvedValue({
            directory: { item: [{ name: 'main0.htm', size: '1' }] },
        });
        sec.fetchFilingDocumentHead.mockResolvedValue(
            '<p>FORM 8-K</p><p>Item 5.02. Departure of Directors or Certain Officers</p><p>Jane Doe resigned as a director on November 1, 2026. More follows.</p>'
        );
        const result = await listCompanyFilings('IONQ');
        if (result.status !== 'ok') throw new Error('expected ok');
        expect(result.filings[0]).toMatchObject({
            headline: 'Jane Doe resigned as a director on November 1, 2026.',
            hasPressRelease: false,
            url: `${FOLDER}/${accessionOf(0).replaceAll('-', '')}/main0.htm`,
        });
    });
});

describe('readCompanyFiling', () => {
    it('접수번호의 보도자료 본문을 돌려주고 본문을 30일 캐시한다', async () => {
        happyPath();
        const result = await readCompanyFiling('IONQ', accessionOf(1));
        if (result.status !== 'ok') throw new Error('expected ok');
        expect(result.filing).toMatchObject({
            accession: accessionOf(1),
            document: 'press_release',
            hasPressRelease: true,
            headline: 'Headline number 1 announces results',
            truncated: false,
            url: `${FOLDER}/${accessionOf(1).replaceAll('-', '')}/x-ex99_1.htm`,
        });
        expect(result.filing.text).toBe(
            'Headline number 1 announces results\n●Body text of release 1.'
        );
        expect(result.filing.totalChars).toBe(result.filing.text.length);
        const textWrite = cache.writes.find(
            w => w.key === `sec:filing-text:v3:${accessionOf(1)}`
        );
        expect(textWrite?.ttl).toBe(2_592_000);
        expect(cache.store.get(`sec:filing-text:v3:${accessionOf(1)}`)).toEqual(
            {
                fileName: 'x-ex99_1.htm',
                document: 'press_release',
                headline: 'Headline number 1 announces results',
                text: result.filing.text,
                truncated: false,
                totalChars: result.filing.text.length,
            }
        );
    });

    it('차가운 읽기는 제출 목록 1 + 색인 1 + 문서 앞부분 1 = 3건이다', async () => {
        happyPath();
        await readCompanyFiling('IONQ', accessionOf(1));
        expect(sec.fetchSubmissionsJson).toHaveBeenCalledTimes(1);
        expect(sec.fetchFilingIndexJson).toHaveBeenCalledTimes(1);
        expect(sec.fetchFilingDocumentHead).toHaveBeenCalledTimes(1);
        expect(secCallCount()).toBe(3);
    });

    it('목록이 이미 읽은 공시를 읽으면 SEC를 부르지 않는다(head를 두 번 받지 않는다)', async () => {
        happyPath();
        await listCompanyFilings('IONQ');
        const before = secCallCount();
        const result = await readCompanyFiling('IONQ', accessionOf(2));
        expect(result.status).toBe('ok');
        expect(secCallCount()).toBe(before);
    });

    it('반대로 읽기 뒤의 목록은 그 공시의 메타를 다시 받지 않는다', async () => {
        happyPath();
        await readCompanyFiling('IONQ', accessionOf(2));
        sec.fetchFilingIndexJson.mockClear();
        await listCompanyFilings('IONQ');
        expect(
            sec.fetchFilingIndexJson.mock.calls.some(
                c => c[1] === accessionOf(2)
            )
        ).toBe(false);
    });

    it('목록 상위 10건 밖이지만 창 안인 접수번호도 읽는다', async () => {
        happyPath();
        const outside = accessionOf(11);
        const list = await listCompanyFilings('IONQ');
        if (list.status !== 'ok') throw new Error('expected ok');
        expect(list.filings.map(f => f.accession)).not.toContain(outside);
        const result = await readCompanyFiling('IONQ', outside);
        expect(result.status).toBe('ok');
    });

    it('창 밖이거나 목록에 없는 접수번호는 unknown_filing이고 문서를 읽지 않는다', async () => {
        happyPath();
        expect(await readCompanyFiling('IONQ', '0000000000-26-000001')).toEqual(
            { status: 'unknown_filing' }
        );
        expect(sec.fetchFilingIndexJson).not.toHaveBeenCalled();
        expect(sec.fetchFilingDocumentHead).not.toHaveBeenCalled();
    });

    it('정제 본문이 AGENT_FILING_TEXT_MAX_CHARS를 넘으면 잘라 truncated로 알리고 잘린 본문만 캐시한다', async () => {
        happyPath();
        const long = `<p>Headline for the long release goes here</p>${'<p>Sentence number one is here. And another one follows it.</p>'.repeat(600)}`;
        sec.fetchFilingDocumentHead.mockResolvedValue(long);
        const result = await readCompanyFiling('IONQ', accessionOf(0));
        if (result.status !== 'ok') throw new Error('expected ok');
        expect(result.filing.truncated).toBe(true);
        expect(result.filing.text.length).toBeLessThanOrEqual(
            AGENT_FILING_TEXT_MAX_CHARS
        );
        // totalChars는 읽은 앞부분(head)의 정제 길이다.
        expect(result.filing.totalChars).toBeGreaterThan(
            AGENT_FILING_TEXT_MAX_CHARS
        );
        const cached = cache.store.get(
            `sec:filing-text:v3:${accessionOf(0)}`
        ) as { text: string };
        expect(cached.text).toBe(result.filing.text);
    });

    it('head가 바이트 상한에 닿았으면 정제 본문이 짧아도 truncated이다(문서가 더 길다)', async () => {
        happyPath();
        sec.fetchFilingDocumentHead.mockResolvedValue(
            `<p>Headline of a very large document</p><p>${'a'.repeat(HEAD_CAP)}</p>`.slice(
                0,
                HEAD_CAP
            )
        );
        const result = await readCompanyFiling('IONQ', accessionOf(0));
        if (result.status !== 'ok') throw new Error('expected ok');
        expect(result.filing.truncated).toBe(true);
    });

    it('head가 상한보다 작고 본문이 짧으면 truncated가 아니다', async () => {
        happyPath();
        const result = await readCompanyFiling('IONQ', accessionOf(0));
        if (result.status !== 'ok') throw new Error('expected ok');
        expect(result.filing.truncated).toBe(false);
    });

    it('전문 다운로드(fetchFilingDocumentText)는 쓰지 않는다 — 읽기도 head 한 번이다', async () => {
        happyPath();
        await readCompanyFiling('IONQ', accessionOf(0));
        expect(sec.fetchFilingDocumentHead).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['head가 null', null],
        ['head가 정제 후 빈 문자열', '<script>x</script>'],
    ])('%s이면 failed이고 캐시하지 않는다', async (_label, html) => {
        happyPath();
        sec.fetchFilingDocumentHead.mockResolvedValue(html);
        expect(await readCompanyFiling('IONQ', accessionOf(0))).toEqual({
            status: 'failed',
        });
        expect(cache.store.has(`sec:filing-text:v3:${accessionOf(0)}`)).toBe(
            false
        );
    });

    it('SEC가 막으면 failed', async () => {
        happyPath();
        sec.fetchFilingDocumentHead.mockRejectedValue(blockedError());
        expect(await readCompanyFiling('IONQ', accessionOf(0))).toEqual({
            status: 'failed',
        });
    });

    it('색인을 못 읽으면 어느 파일을 읽을지 모르므로 failed', async () => {
        happyPath();
        sec.fetchFilingIndexJson.mockResolvedValue(null);
        expect(await readCompanyFiling('IONQ', accessionOf(0))).toEqual({
            status: 'failed',
        });
        expect(sec.fetchFilingDocumentHead).not.toHaveBeenCalled();
    });

    it('제출 목록 실패는 failed', async () => {
        happyPath();
        sec.fetchSubmissionsJson.mockRejectedValue(new Error('down'));
        expect(await readCompanyFiling('IONQ', accessionOf(0))).toEqual({
            status: 'failed',
        });
    });
});

describe('listCompanyFilings headlinesPending', () => {
    async function listOk() {
        const result = await listCompanyFilings('IONQ');
        if (result.status !== 'ok') throw new Error('expected ok');
        return result;
    }

    it('모두 읽혔으면 false다', async () => {
        happyPath();
        expect((await listOk()).headlinesPending).toBe(false);
    });

    it('읽고도 제목이 없는 공시는 headline null이어도 pending이 아니다 — 30일 캐시된다', async () => {
        happyPath();
        // 보도자료도 Item 본문도 없는 주 문서: 정제 본문은 있지만 뽑을 제목이 없다.
        sec.fetchFilingIndexJson.mockImplementation(async () => ({
            directory: {
                item: [{ name: 'main0.htm', size: '100' }],
            },
        }));
        sec.fetchFilingDocumentHead.mockResolvedValue(
            '<html><body><p>Washington, D.C. 20549</p></body></html>'
        );
        const result = await listOk();
        const settledAsNull = result.filings
            .slice(0, FILING_META_LOAD_MAX)
            .filter(f => f.headline === null);
        // 가정 확인: 이 문서는 실제로 제목 없이 "읽힌" 상태여야 한다(거부가 아니라).
        expect(settledAsNull.length).toBeGreaterThan(0);
        expect(cache.store.has(`sec:filing-meta:v2:${accessionOf(0)}`)).toBe(
            true
        );
        expect(result.headlinesPending).toBe(false);
    });

    it('비차단 사유로 메타가 거부되면 pending이다(목록 안 위치 무관 — 시도한 마지막 공시 포함)', async () => {
        happyPath();
        const last = accessionOf(FILING_META_LOAD_MAX - 1);
        sec.fetchFilingIndexJson.mockImplementation(
            async (_cik: string, accession: string) => {
                if (accession === last) throw new Error('boom');
                return indexJson(indexOfAccession(accession));
            }
        );
        expect((await listOk()).headlinesPending).toBe(true);
    });

    it('시도하지 않은 뒤쪽 공시(FILING_META_LOAD_MAX 이후)의 headline null은 pending이 아니다', async () => {
        happyPath();
        const result = await listOk();
        expect(result.filings[FILING_META_LOAD_MAX]?.headline).toBeNull();
        expect(result.headlinesPending).toBe(false);
    });

    it.each([
        ['SEC 차단(403·429)', () => blockedError()],
        ['슬롯 대기 예산 초과', () => new SecSlotTimeoutError()],
        ['본문 수신 시간 초과', () => new SecBodyTimeoutError('budget')],
        [
            '요청 시간 초과(abort — AbortError)',
            () => new DOMException('aborted', 'AbortError'),
        ],
        [
            '요청 시간 초과(TimeoutError)',
            () => new DOMException('timed out', 'TimeoutError'),
        ],
    ])(
        '%s로 거부되면 pending이 아니다 — 짧게 다시 그리면 한도를 더 두드린다',
        async (_name, make) => {
            happyPath();
            sec.fetchFilingIndexJson.mockRejectedValue(make());
            const result = await listOk();
            expect(result.filings.every(f => f.headline === null)).toBe(true);
            expect(result.headlinesPending).toBe(false);
        }
    );

    it('state.blocked는 같은 호출의 다른(비차단) 거부보다 우선한다 — pending이 아니다', async () => {
        happyPath();
        sec.fetchFilingIndexJson.mockImplementation(
            async (_cik: string, accession: string) => {
                if (accession === accessionOf(0)) throw blockedError();
                if (accession === accessionOf(1)) throw new Error('boom');
                return indexJson(indexOfAccession(accession));
            }
        );
        expect((await listOk()).headlinesPending).toBe(false);
    });
});

describe('결정적 실패는 제목 없는 메타로 캐시된다', () => {
    // 모든 공시가 게시 대기 기간(접수일 + 2일)을 한참 지난 시각.
    beforeEach(() => {
        vi.setSystemTime(new Date('2026-12-01T00:00:00Z'));
    });

    const permanent: [string, () => void][] = [
        [
            '색인이 없다(null)',
            () => sec.fetchFilingIndexJson.mockResolvedValue(null),
        ],
        [
            '문서 앞부분이 없다(null)',
            () => sec.fetchFilingDocumentHead.mockResolvedValue(null),
        ],
        [
            '정제하면 본문이 빈다',
            () =>
                sec.fetchFilingDocumentHead.mockResolvedValue(
                    '<html><body></body></html>'
                ),
        ],
    ];

    it.each(permanent)(
        '%s: headline null로 30일 캐시하고 pending이 아니며 다음 호출은 SEC를 다시 부르지 않는다',
        async (_name, arrange) => {
            happyPath();
            arrange();
            const first = await listCompanyFilings('IONQ');
            if (first.status !== 'ok') throw new Error('expected ok');
            expect(first.headlinesPending).toBe(false);
            expect(first.filings[0]).toMatchObject({
                headline: null,
                hasPressRelease: false,
                url: `${FOLDER}/${accessionOf(0).replaceAll('-', '')}/main0.htm`,
            });
            expect(
                cache.writes.find(
                    w => w.key === `sec:filing-meta:v2:${accessionOf(0)}`
                )?.ttl
            ).toBe(30 * SECONDS_PER_DAY);
            const calls = secCallCount();
            const again = await listCompanyFilings('IONQ');
            if (again.status !== 'ok') throw new Error('expected ok');
            expect(again.headlinesPending).toBe(false);
            // 제출 목록(30분 캐시 목) 외 공시별 SEC 요청은 없다.
            expect(secCallCount() - calls).toBeLessThanOrEqual(1);
        }
    );

    it('일시 거부(generic)는 그대로 캐시되지 않고 pending이다', async () => {
        happyPath();
        sec.fetchFilingIndexJson.mockRejectedValue(new Error('boom'));
        const result = await listCompanyFilings('IONQ');
        if (result.status !== 'ok') throw new Error('expected ok');
        expect(result.headlinesPending).toBe(true);
        expect(cache.store.has(`sec:filing-meta:v2:${accessionOf(0)}`)).toBe(
            false
        );
    });

    it('본문 읽기(readCompanyFiling)는 여전히 failed다 — 제목 메타만 캐시한다', async () => {
        happyPath();
        sec.fetchFilingDocumentHead.mockResolvedValue(null);
        await listCompanyFilings('IONQ');
        const read = await readCompanyFiling('IONQ', accessionOf(0));
        expect(read.status).toBe('failed');
    });
});

describe('접수 직후 공시의 "없음"은 일시 사유다 (FILING_PUBLICATION_WINDOW_MS)', () => {
    // 최신 공시(accessionOf(0))의 접수일은 2026-11-13 → 접수일 끝은 11-14T00:00Z.
    const EDGE =
        Date.parse('2026-11-14T00:00:00Z') + FILING_PUBLICATION_WINDOW_MS;

    async function listAt(now: number) {
        vi.setSystemTime(new Date(now));
        happyPath();
        sec.fetchFilingIndexJson.mockResolvedValue(null);
        const result = await listCompanyFilings('IONQ');
        if (result.status !== 'ok') throw new Error('expected ok');
        return result;
    }

    it('기간 안(접수 다음 날)의 404는 캐시하지 않고 pending이다', async () => {
        const result = await listAt(Date.parse('2026-11-14T12:00:00Z'));
        expect(result.headlinesPending).toBe(true);
        expect(cache.store.has(`sec:filing-meta:v2:${accessionOf(0)}`)).toBe(
            false
        );
    });

    it('기간이 지난 404는 headline null 메타를 30일 캐시하고 pending이 아니다', async () => {
        const result = await listAt(EDGE + MS_PER_DAY);
        expect(result.headlinesPending).toBe(false);
        expect(cache.store.has(`sec:filing-meta:v2:${accessionOf(0)}`)).toBe(
            true
        );
    });

    it('경계: 정확히 기간 끝이면 아직 일시, 1ms 뒤부터 영구다', async () => {
        expect((await listAt(EDGE)).headlinesPending).toBe(true);
        cache.store.clear();
        sec.fetchFilingIndexJson.mockReset();
        expect((await listAt(EDGE + 1)).headlinesPending).toBe(false);
    });
});
