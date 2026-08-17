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

// 실측(2026-08-17) 응답 형태 — `srtnCd`에 `A` 접두사가 붙어 온다.
const SAMSUNG = {
    srtnCd: 'A005930',
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

    it('strips the A prefix so the code matches our canonical symbol shape', async () => {
        // 실측 실패 사례: 접두사를 그대로 두면 형상 검사에서 전 종목이 탈락해
        // 시드가 조용히 0건으로 끝났다.
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

    it('accepts a bare 6-digit code too (in case the prefix disappears)', async () => {
        fetchSpy.mockResolvedValue(page([{ ...SAMSUNG, srtnCd: '005930' }]));

        const [item] = await fetchKrxListedItems();
        expect(item!.shortCode).toBe('005930');
    });

    it('sends the service key and requests JSON', async () => {
        fetchSpy.mockResolvedValue(page([SAMSUNG]));

        await fetchKrxListedItems();

        const url = String(fetchSpy.mock.calls[0]![0]);
        expect(url).toContain('serviceKey=test-key');
        expect(url).toContain('resultType=json');
    });

    it('always pins a basDt — omitting it returns the whole history', async () => {
        // 실측: basDt 없이 부르면 totalCount가 4,166,892(전 기간 누적)로 돌아온다.
        fetchSpy.mockResolvedValue(page([SAMSUNG]));

        await fetchKrxListedItems();

        expect(String(fetchSpy.mock.calls[0]![0])).toMatch(/basDt=\d{8}/);
    });

    it('walks back a day at a time until a business day returns rows', async () => {
        // 주말·공휴일이거나 아직 갱신 전(기준일 다음 영업일 13시)이면 그 날짜는 빈다.
        fetchSpy
            .mockResolvedValueOnce(page([]))
            .mockResolvedValueOnce(page([]))
            .mockResolvedValue(page([SAMSUNG]));

        const items = await fetchKrxListedItems();

        expect(items).toHaveLength(1);
        expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('uses only the given basDt when one is supplied', async () => {
        fetchSpy.mockResolvedValue(page([]));

        await fetchKrxListedItems('20260814');

        expect(String(fetchSpy.mock.calls[0]![0])).toContain('basDt=20260814');
        // 명시된 날짜가 비어도 다른 날로 넘어가지 않는다 — 호출자의 의도를 존중한다.
        expect(fetchSpy).toHaveBeenCalledTimes(1);
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
        [{ ...SAMSUNG, srtnCd: 'A5930' }, '6자리 아님'],
        [{ ...SAMSUNG, srtnCd: 'AKR12345' }, '숫자 아님'],
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

    it('decodes an Encoding-form service key before sending it', async () => {
        // 포털은 같은 키를 Encoding/Decoding 두 형태로 준다. Encoding 키를 그대로
        // 넘기면 URLSearchParams가 `%`를 `%25`로 한 번 더 인코딩해 인증이 깨진다.
        // 실측: Decoding 형태 200 OK / Encoding 형태 그대로 403.
        vi.stubEnv('DATA_GO_KR_SERVICE_KEY', 'abc%2Bdef%3D');
        fetchSpy.mockResolvedValue(page([SAMSUNG]));

        await fetchKrxListedItems();

        const url = String(fetchSpy.mock.calls[0]![0]);
        // 디코딩 후 URLSearchParams가 다시 인코딩하므로 최종 쿼리는 단일 인코딩이다.
        expect(url).toContain('serviceKey=abc%2Bdef%3D');
        expect(url).not.toContain('%25');
    });

    it('passes a Decoding-form key through unchanged', async () => {
        vi.stubEnv('DATA_GO_KR_SERVICE_KEY', 'abc+def=');
        fetchSpy.mockResolvedValue(page([SAMSUNG]));

        await fetchKrxListedItems();

        expect(String(fetchSpy.mock.calls[0]![0])).toContain(
            'serviceKey=abc%2Bdef%3D'
        );
    });

    it('survives a key containing a stray percent sign', async () => {
        // `decodeURIComponent`가 URIError를 던지는 입력 — 원본을 그대로 써야 한다.
        vi.stubEnv('DATA_GO_KR_SERVICE_KEY', '100%off');
        fetchSpy.mockResolvedValue(page([SAMSUNG]));

        await expect(fetchKrxListedItems()).resolves.toHaveLength(1);
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
