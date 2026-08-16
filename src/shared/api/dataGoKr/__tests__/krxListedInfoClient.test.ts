import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    fetchKrxListedItems,
    hasDataGoKrCredentials,
} from '../krxListedInfoClient';

const fetchSpy = vi.fn();

function page(items: unknown[], totalCount = items.length) {
    return {
        ok: true,
        status: 200,
        json: async () => ({
            response: {
                header: { resultCode: '00', resultMsg: 'OK' },
                body: { totalCount, items: { item: items } },
            },
        }),
    } as unknown as Response;
}

const SAMSUNG = {
    srtnCd: '005930',
    itmsNm: '삼성전자',
    mrktCtg: 'KOSPI',
    isinCd: 'KR7005930003',
    corpNm: '삼성전자주식회사',
};

describe('fetchKrxListedItems', () => {
    beforeEach(() => {
        vi.stubEnv('DATA_GO_KR_SERVICE_KEY', 'test-key');
        fetchSpy.mockReset();
        vi.stubGlobal('fetch', fetchSpy);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it('maps a listed item to the domain shape', async () => {
        fetchSpy.mockResolvedValue(page([SAMSUNG]));

        expect(await fetchKrxListedItems()).toEqual([
            {
                shortCode: '005930',
                koreanName: '삼성전자',
                market: 'KOSPI',
                isin: 'KR7005930003',
                corpName: '삼성전자주식회사',
            },
        ]);
    });

    it('sends the service key and requests JSON', async () => {
        fetchSpy.mockResolvedValue(page([]));

        await fetchKrxListedItems();

        const url = String(fetchSpy.mock.calls[0]![0]);
        expect(url).toContain('serviceKey=test-key');
        expect(url).toContain('resultType=json');
    });

    it('forwards basDt when given', async () => {
        fetchSpy.mockResolvedValue(page([]));

        await fetchKrxListedItems('20260814');

        expect(String(fetchSpy.mock.calls[0]![0])).toContain('basDt=20260814');
    });

    it('paginates until the total count is reached', async () => {
        const first = Array.from({ length: 1000 }, (_, i) => ({
            ...SAMSUNG,
            srtnCd: String(100000 + i),
        }));
        fetchSpy
            .mockResolvedValueOnce(page(first, 1001))
            .mockResolvedValueOnce(page([SAMSUNG], 1001));

        const items = await fetchKrxListedItems();

        expect(items).toHaveLength(1001);
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('stops on an empty page even when totalCount is missing', async () => {
        fetchSpy
            .mockResolvedValueOnce(page([SAMSUNG], 0))
            .mockResolvedValueOnce(page([], 0));

        expect(await fetchKrxListedItems()).toHaveLength(1);
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('accepts items delivered as a bare array', async () => {
        // 공공데이터포털은 `items: { item: [...] }`와 `items: [...]`를 혼용한다.
        fetchSpy.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                response: {
                    header: { resultCode: '00' },
                    body: { totalCount: 1, items: [SAMSUNG] },
                },
            }),
        } as unknown as Response);

        expect(await fetchKrxListedItems()).toHaveLength(1);
    });

    it.each([
        [{ ...SAMSUNG, srtnCd: undefined }, '단축코드 없음'],
        [{ ...SAMSUNG, itmsNm: undefined }, '종목명 없음'],
        [{ ...SAMSUNG, mrktCtg: 'ETC' }, '알 수 없는 시장'],
        [{ ...SAMSUNG, srtnCd: '5930' }, '6자리 아님'],
    ])('drops unusable rows (%#: %s)', async (raw, _label) => {
        fetchSpy.mockResolvedValue(page([raw]));
        expect(await fetchKrxListedItems()).toEqual([]);
    });

    it('keeps KONEX rows — the seed decides what to skip', async () => {
        // 클라이언트는 원본을 충실히 전달하고, 시세 유무에 따른 제외는 시드가 판단한다.
        fetchSpy.mockResolvedValue(page([{ ...SAMSUNG, mrktCtg: 'KONEX' }]));
        const items = await fetchKrxListedItems();
        expect(items[0]!.market).toBe('KONEX');
    });

    it('throws on a non-OK resultCode carried inside HTTP 200', async () => {
        // 공공데이터포털은 인증 실패도 HTTP 200 + resultCode로 보낸다.
        fetchSpy.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                response: {
                    header: {
                        resultCode: '30',
                        resultMsg: 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR',
                    },
                },
            }),
        } as unknown as Response);

        await expect(fetchKrxListedItems()).rejects.toThrow('resultCode=30');
    });

    it('throws on an HTTP error', async () => {
        fetchSpy.mockResolvedValue({ ok: false, status: 500 } as Response);
        await expect(fetchKrxListedItems()).rejects.toThrow('HTTP 500');
    });

    it('returns empty without calling the API when the key is missing', async () => {
        vi.stubEnv('DATA_GO_KR_SERVICE_KEY', '');

        expect(await fetchKrxListedItems()).toEqual([]);
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});

describe('hasDataGoKrCredentials', () => {
    afterEach(() => vi.unstubAllEnvs());

    it('reflects the env var', () => {
        vi.stubEnv('DATA_GO_KR_SERVICE_KEY', 'k');
        expect(hasDataGoKrCredentials()).toBe(true);
        vi.stubEnv('DATA_GO_KR_SERVICE_KEY', '');
        expect(hasDataGoKrCredentials()).toBe(false);
    });
});
