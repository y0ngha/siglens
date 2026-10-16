import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    fetchKrxListedItems,
    fetchStockPriceItems,
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
                basDt: expect.stringMatching(/^\d{8}$/),
                listedShares: null,
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

    /**
     * [회귀] wall-clock 예산은 **페이지 단위로** 재야 도달한다.
     *
     * 후보 루프에서만 재면 영원히 걸리지 않는다 — `collectAllPages`는 첫 페이지가
     * 비었을 때만 `[]`를 돌려주고, 한 건이라도 있으면 호출부가 즉시 반환하므로
     * 후보를 넘기는 경로는 후보당 정확히 1페이지(≤ 10 × 10초 < 120초)다. 실제
     * 위험은 반대쪽이다: 한 후보가 `MAX_PAGES`를 다 쓰면 20 × 10초 = 200초로
     * 배포 드레인 창(180초)을 넘긴다. 이 수집은 `after()` 안에서 돌고 그 promise가
     * SIGTERM 드레인에 등록돼 있어 그만큼 종료를 붙잡는다.
     *
     * 가짜 타이머로 페이지당 30초를 흘려보내면 3페이지를 받은 시점에 정확히 90초라
     * 4페이지째 검사에서 멈춘다 — MAX_PAGES(20)에 한참 못 미치는 지점이라, 상한이
     * 페이지 수가 아니라 시간에서 오는지가 판별된다.
     */
    it('예산이 닳으면 MAX_PAGES 전에 수집을 멈춘다', async () => {
        vi.useFakeTimers();
        try {
            // 매 페이지가 가득 차 있어 종료 조건(빈 페이지·totalCount 도달)에 절대
            // 걸리지 않는다 — 멈추는 이유가 예산뿐이도록.
            fetchSpy.mockImplementation(async () => {
                vi.advanceTimersByTime(30_000);
                return page(
                    Array.from({ length: 1000 }, (_, i) => ({
                        ...SAMSUNG,
                        srtnCd: `A${String(i).padStart(6, '0')}`,
                    })),
                    999_999 // totalCount를 크게 둬 페이지 소진으로는 안 끝나게.
                );
            });

            await fetchKrxListedItems();

            expect(fetchSpy.mock.calls.length).toBeLessThan(20); // MAX_PAGES
            expect(fetchSpy.mock.calls.length).toBe(3); // 70초 예산: 0·30·60초에 시작
        } finally {
            vi.useRealTimers();
        }
    });

    /**
     * [회귀] 예산 검사는 fetch **앞**에만 있으므로, 예산 1ms 전에 통과한 페이지가
     * `PAGE_TIMEOUT_MS`를 통째로 더 쓰면 상한이 예산 + 10초가 된다. 드레인 창
     * (180초) 안에서 수집 뒤 DB 단계까지 끝나야 하므로 그 초과분이 그대로 위험이다.
     * 마지막 페이지의 타임아웃을 남은 예산으로 잘라 초과 자체를 없앤다.
     */
    it('마지막 페이지 타임아웃을 남은 예산으로 자른다', async () => {
        vi.useFakeTimers();
        try {
            const timeouts: number[] = [];
            const realTimeout = AbortSignal.timeout.bind(AbortSignal);
            vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
                timeouts.push(ms);
                return realTimeout(ms);
            });
            // 페이지당 32초 — 3페이지째 진입 시각이 64초라 남은 예산(70초)이 6초다.
            fetchSpy.mockImplementation(async () => {
                vi.advanceTimersByTime(32_000);
                return page([SAMSUNG], 999_999);
            });

            await fetchKrxListedItems();

            // 3번째가 10초면 총 74초로 예산을 넘긴다.
            expect(timeouts).toEqual([10_000, 10_000, 6_000]);
        } finally {
            vi.useRealTimers();
            vi.restoreAllMocks();
        }
    });

    /**
     * [회귀] 클램프만 두면 `remaining`이 수십 ms일 때 곧 도착했을 응답까지 끊고,
     * 그 abort가 `TimeoutError`로 올라가 이미 모은 페이지를 통째로 버린다
     * (감사 라운드 13). 하한 밑에서는 페이지를 시작하지 않고 모은 만큼 들고 나온다.
     */
    it('남은 예산이 하한 미만이면 페이지를 시작하지 않고 모은 만큼 반환한다', async () => {
        vi.useFakeTimers();
        try {
            // 페이지당 69.5초 — 1페이지를 받고 나면 남은 예산이 500ms로 하한 미만이다.
            fetchSpy.mockImplementation(async () => {
                vi.advanceTimersByTime(69_500);
                return page([SAMSUNG], 999_999);
            });

            const items = await fetchKrxListedItems();

            expect(fetchSpy).toHaveBeenCalledTimes(1);
            // throw가 아니라 모은 결과가 나온다.
            expect(items).toHaveLength(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it('returns empty without calling the API when the key is missing', async () => {
        vi.stubEnv('DATA_GO_KR_SERVICE_KEY', '');

        expect(await fetchKrxListedItems()).toEqual([]);
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});

describe('영문 단축코드', () => {
    beforeEach(() => {
        vi.stubEnv('DATA_GO_KR_SERVICE_KEY', 'test-key');
        fetchSpy.mockReset();
        vi.stubGlobal('fetch', fetchSpy);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it('영문이 섞인 단축코드를 버리지 않는다', async () => {
        // [회귀] `^\d{6}$`로 걸러 신규 상장 64종목이 마스터에서 통째로 빠졌었다.
        fetchSpy.mockResolvedValue(
            page([
                {
                    ...SAMSUNG,
                    srtnCd: 'A0001A0',
                    itmsNm: '덕양에너젠',
                    mrktCtg: 'KOSDAQ',
                },
            ])
        );

        const items = await fetchKrxListedItems('20261014');

        expect(items.map(i => [i.shortCode, i.basDt])).toEqual([
            ['0001A0', '20261014'],
        ]);
    });
});

describe('fetchStockPriceItems', () => {
    beforeEach(() => {
        vi.stubEnv('DATA_GO_KR_SERVICE_KEY', 'test-key');
        fetchSpy.mockReset();
        vi.stubGlobal('fetch', fetchSpy);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    // 실측(2026-10-15) V2 응답 — `srtnCd`에 `A` 접두사가 없고 시세 필드가 함께 온다.
    const HYUNDAI_PREF = {
        basDt: '20261014',
        srtnCd: '005387',
        isinCd: 'KR7005387006',
        itmsNm: '현대차2우B',
        mrktCtg: 'KOSPI',
        clpr: '153700',
        lstgStCnt: '36613865',
    };

    it('V2 엔드포인트를 주어진 기준일로 호출한다', async () => {
        fetchSpy.mockResolvedValue(page([HYUNDAI_PREF]));

        await fetchStockPriceItems('20261014');

        const url = String(fetchSpy.mock.calls[0]?.[0]);
        // 옛 경로(`/service/GetStockSecuritiesInfoService/getStockPriceInfo`)는 403이다.
        expect(url).toContain(
            '/1160100/GetStockSecuritiesInfoService_V2/getStockPriceInfo_V2?'
        );
        expect(url).not.toContain('/service/');
        expect(new URL(url).searchParams.get('basDt')).toBe('20261014');
    });

    it('우선주·영문코드를 매핑하고 법인명이 없으면 종목명을 쓴다', async () => {
        fetchSpy.mockResolvedValue(
            page([
                HYUNDAI_PREF,
                {
                    ...HYUNDAI_PREF,
                    srtnCd: '00088K',
                    itmsNm: '한화3우B',
                    isinCd: '',
                    lstgStCnt: '',
                },
            ])
        );

        const { items, truncated } = await fetchStockPriceItems('20261014');

        expect(truncated).toBe(false);
        expect(items).toEqual([
            {
                shortCode: '005387',
                koreanName: '현대차2우B',
                market: 'KOSPI',
                isin: 'KR7005387006',
                corpName: '현대차2우B',
                basDt: '20261014',
                listedShares: 36_613_865,
            },
            {
                shortCode: '00088K',
                koreanName: '한화3우B',
                market: 'KOSPI',
                isin: '',
                corpName: '한화3우B',
                basDt: '20261014',
                listedShares: null,
            },
        ]);
    });

    it.each([
        [5_919_637_922, 5_919_637_922],
        ['5919637922', 5_919_637_922],
        ['0', null],
        ['1,000', null],
        [12.5, null],
        [undefined, null],
    ])('상장주식수 lstgStCnt %j → %j', async (raw, expected) => {
        fetchSpy.mockResolvedValue(page([{ ...HYUNDAI_PREF, lstgStCnt: raw }]));

        const { items } = await fetchStockPriceItems('20261014');

        expect(items[0]?.listedShares).toBe(expected);
    });

    it('예산이 닳아 멈추면 잘렸다고 알린다', async () => {
        vi.useFakeTimers();
        try {
            // 페이지당 15초 — 20초 예산에서 2페이지째 시작 시 남은 5초, 3페이지째는 하한 미만.
            fetchSpy.mockImplementation(async () => {
                vi.advanceTimersByTime(15_000);
                return page([HYUNDAI_PREF], 999_999);
            });

            const { truncated } = await fetchStockPriceItems('20261014');

            expect(truncated).toBe(true);
            expect(fetchSpy).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });

    it('중간 페이지가 비어 와 totalCount보다 적게 받으면 잘렸다고 알린다', async () => {
        // [회귀] 빈 페이지를 정상 종료로만 보면, 일시적으로 빈 2페이지를 받은 날 보충이
        // "완전"으로 판정되고 빠진 우선주가 상폐된다(25개 미만이면 가드도 통과한다).
        const full = Array.from({ length: 1000 }, (_, i) => ({
            ...HYUNDAI_PREF,
            srtnCd: String(100_000 + i),
        }));
        fetchSpy
            .mockResolvedValueOnce(page(full, 2900))
            .mockResolvedValueOnce(page([], 2900));

        const { items, truncated } = await fetchStockPriceItems('20261014');

        expect(items).toHaveLength(1000);
        expect(truncated).toBe(true);
    });

    it('totalCount만큼 다 받으면 잘리지 않은 것이다', async () => {
        const rows = (n: number, base: number) =>
            Array.from({ length: n }, (_, i) => ({
                ...HYUNDAI_PREF,
                srtnCd: String(base + i),
            }));
        fetchSpy
            .mockResolvedValueOnce(page(rows(1000, 100_000), 1500))
            .mockResolvedValueOnce(page(rows(500, 200_000), 1500));

        const { items, truncated } = await fetchStockPriceItems('20261014');

        expect(items).toHaveLength(1500);
        expect(truncated).toBe(false);
    });

    it('키가 없으면 호출 없이 빈 목록', async () => {
        vi.stubEnv('DATA_GO_KR_SERVICE_KEY', '');

        expect(await fetchStockPriceItems('20261014')).toEqual({
            items: [],
            truncated: false,
        });
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('HTTP 오류는 던진다 — 호출부가 보충 불가로 처리한다', async () => {
        fetchSpy.mockResolvedValue({ ok: false, status: 403 } as Response);

        await expect(fetchStockPriceItems('20261014')).rejects.toThrow(
            '[stockPriceInfo] HTTP 403'
        );
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
