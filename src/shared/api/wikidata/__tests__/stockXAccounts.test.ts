vi.mock('server-only', () => ({}));

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WIKIPEDIA_USER_AGENT } from '@/shared/api/wikipedia/indexConstituents';
import { fetchStockXAccounts } from '../stockXAccounts';

/** 2026-11-16 실제 위키데이터 SPARQL 응답(이 모듈의 `buildQuery`로 받았다). */
const fixture = (name: string): unknown =>
    JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf-8'));

const fetchSpy = vi.fn(
    async (input: unknown, _init?: RequestInit): Promise<Response> => {
        throw new Error(`unexpected fetch: ${String(input)}`);
    }
);

beforeEach(() => {
    vi.stubGlobal('fetch', fetchSpy);
});
afterEach(() => {
    vi.unstubAllGlobals();
    fetchSpy.mockReset();
    fetchSpy.mockImplementation(async input => {
        throw new Error(`unexpected fetch: ${String(input)}`);
    });
});

/** 응답 하나를 받아 공개 함수로 해석한다(파서는 모듈 내부다). */
async function parse(json: unknown) {
    fetchSpy.mockResolvedValueOnce(Response.json(json));
    return fetchStockXAccounts('TSLA');
}

const Q = (id: string) => ({ value: `http://www.wikidata.org/entity/${id}` });
const rank = (name: string) => ({ value: `http://wikiba.se/ontology#${name}` });

describe('응답 해석(fetchStockXAccounts)', () => {
    it('TSLA: 인물의 계정이 둘이면 우선 순위 계정(@elonmusk)만 남긴다', async () => {
        expect(await parse(fixture('tsla.json'))).toEqual({
            companyHandles: ['Tesla'],
            executives: [{ name: 'Elon Musk', handles: ['elonmusk'] }],
        });
    });

    it('AAPL: 회사 계정 중 우선 순위(@Apple)만, 다국어 라벨(mul)만 있는 CEO 이름도 읽는다', async () => {
        expect(await parse(fixture('aapl.json'))).toEqual({
            companyHandles: ['Apple'],
            executives: [{ name: 'John Ternus', handles: ['johnternus'] }],
        });
    });

    it('MSFT: 지원·지역 계정 열한 개를 거르고 대표 계정 하나만', async () => {
        expect(await parse(fixture('msft.json'))).toEqual({
            companyHandles: ['Microsoft'],
            executives: [{ name: 'Satya Nadella', handles: ['satyanadella'] }],
        });
    });

    it('IONQ: 회사 항목은 있지만 계정·CEO 진술이 없다', async () => {
        expect(await parse(fixture('ionq.json'))).toEqual({
            companyHandles: [],
            executives: [],
        });
    });

    it('우선 순위 CEO 진술이 있으면 순위가 보통인 전임자 진술은 쓰지 않는다', async () => {
        const row = (id: string, label: string, r: string, handle: string) => ({
            company: Q('Q1'),
            ceo: Q(id),
            ceoLabel: { value: label },
            csRank: rank(r),
            ceoX: { value: handle },
        });
        const parsed = await parse({
            results: {
                bindings: [
                    row('Q2', 'Former Chief', 'NormalRank', 'former'),
                    row('Q3', 'New Chief', 'PreferredRank', 'newchief'),
                ],
            },
        });
        expect(parsed.executives).toEqual([
            { name: 'New Chief', handles: ['newchief'] },
        ]);
    });

    it('티커가 회사 항목 둘에 걸려 있으면 어느 회사인지 모르므로 빈 결과', async () => {
        expect(
            await parse({
                results: {
                    bindings: [
                        { company: Q('Q1'), companyX: { value: 'livecorp' } },
                        { company: Q('Q2'), companyX: { value: 'gonecorp' } },
                    ],
                },
            })
        ).toEqual({ companyHandles: [], executives: [] });
    });

    it('라벨이 QID뿐이면 이름은 null, 핸들 모양이 아닌 값은 버린다', async () => {
        expect(
            await parse({
                results: {
                    bindings: [
                        {
                            company: Q('Q9'),
                            companyX: { value: 'bad handle!' },
                            ceo: Q('Q1'),
                            ceoLabel: { value: 'Q1' },
                            ceoX: { value: 'ok_handle' },
                        },
                    ],
                },
            })
        ).toEqual({
            companyHandles: [],
            executives: [{ name: null, handles: ['ok_handle'] }],
        });
    });
});

describe('fetchStockXAccounts', () => {
    it('식별 User-Agent·타임아웃을 싣고, 과거·폐기 진술을 빼는 질의를 보낸다', async () => {
        fetchSpy.mockResolvedValueOnce(Response.json(fixture('tsla.json')));
        const result = await fetchStockXAccounts('TSLA');
        expect(result.companyHandles).toEqual(['Tesla']);
        const [url, init] = fetchSpy.mock.calls[0]!;
        expect(String(url)).toContain('query.wikidata.org/sparql');
        const query = new URL(String(url)).searchParams.get('query') ?? '';
        expect(query).toContain('pq:P249 "TSLA"');
        // 상장·회사 계정·CEO·CEO 계정 네 진술 모두 종료일과 폐기 순위를 뺀다.
        expect(query.match(/!= wikibase:DeprecatedRank/g)).toHaveLength(4);
        expect(query.match(/pq:P582/g)).toHaveLength(4);
        expect((init?.headers as Record<string, string>)['User-Agent']).toBe(
            WIKIPEDIA_USER_AGENT
        );
        expect(init?.signal).toBeInstanceOf(AbortSignal);
    });

    it.each(['tsla', 'BRK B', 'A"B', '005930.ks'])(
        '티커 모양이 아니면(%s) 요청 없이 빈 결과',
        async ticker => {
            expect(await fetchStockXAccounts(ticker)).toEqual({
                companyHandles: [],
                executives: [],
            });
            expect(fetchSpy).not.toHaveBeenCalled();
        }
    );

    it('HTTP 오류와 모양이 틀린 응답은 던진다(빈 결과로 바꾸지 않는다)', async () => {
        fetchSpy.mockResolvedValueOnce(new Response('busy', { status: 429 }));
        await expect(fetchStockXAccounts('TSLA')).rejects.toThrow('429');
        fetchSpy.mockResolvedValueOnce(Response.json({ head: {} }));
        await expect(fetchStockXAccounts('TSLA')).rejects.toThrow('malformed');
    });
});
