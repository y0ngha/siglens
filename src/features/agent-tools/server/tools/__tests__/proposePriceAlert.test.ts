const m = vi.hoisted(() => ({
    secret: {
        value: 'price-alert-test-secret-0123456789abcdef' as string | null,
    },
    profile: vi.fn(),
    asset: vi.fn(),
    getQuote: vi.fn(),
    peek: vi.fn(),
    listForSubscriber: vi.fn(),
    repoCtor: vi.fn(),
    bars: vi.fn(),
}));
vi.mock('@/entities/email-report/emailReportSecret', () => ({
    readEmailReportSecret: () => m.secret.value,
}));
vi.mock('@/entities/ticker/lib/resolveMarketProfile', () => ({
    resolveMarketProfile: m.profile,
}));
vi.mock('@/entities/ticker/server/resolveAssetInfo', () => ({
    resolveAssetInfoOrNull: m.asset,
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({ getQuote: m.getQuote }),
}));
vi.mock('@/entities/bars/server/barsDataCache', () => ({
    getCachedBarsWithIndicators: m.bars,
}));
vi.mock('@/features/agent-tools/server/tools/getCachedAnalysis', () => ({
    peekTechnicalCacheHit: m.peek,
}));
// 저장소에는 읽기 메서드 하나만 있다 — 쓰기 메서드를 부르면 TypeError로 실패한다("아무것도 쓰지 않는다"의 증거).
vi.mock('@/entities/mail-alert/api', () => ({
    DrizzlePriceAlertRepository: vi.fn(function () {
        m.repoCtor();
        return { listForSubscriber: m.listForSubscriber };
    }),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isChatPriceAlertProposalBlock } from '@/entities/chat-conversation/lib/chartBlock';
import type { ChatBlock } from '@/entities/chat-conversation/types';
import {
    priceAlertSubject,
    verifyPriceAlertProposal,
} from '@/entities/mail-alert/server/priceAlertProposalToken';
import { proposePriceAlertTool } from '@/features/agent-tools/server/tools/proposePriceAlert';
import { guestSubject } from '@/shared/lib/guestSubject';

const SECRET = 'price-alert-test-secret-0123456789abcdef';

/** 2026-11-25(수) 10:00 ET — 미국장 개장 중. 마지막 마감 세션은 11-24, 30일 뒤(12-25)는 휴장이라 12-24다. */
const NOW = new Date('2026-11-25T15:00:00Z');
const MEMBER = '11111111-1111-4111-8111-111111111111';
const GUEST = guestSubject('22222222-2222-4222-8222-222222222222');

interface Emitted {
    readonly block: ChatBlock | null;
}

function makeRuntime(emit = true) {
    const emitted: Emitted[] = [];
    const runtime = {
        analysisModel: 'deepseek-v4.1-flash' as const,
        ensureSymbolData: async (): Promise<void> => {},
        ...(emit
            ? {
                  emitChart: (pending: Promise<ChatBlock | null>) => {
                      void pending.then(block => emitted.push({ block }));
                  },
              }
            : {}),
    };
    return { runtime, emitted };
}

const ctxFor = (userId: string, locale: 'ko' | 'en' = 'ko') => ({
    userId,
    tier: userId === GUEST ? ('free' as const) : ('pro' as const),
    locale,
    signal: new AbortController().signal,
});

const PLAN = {
    analyzedAt: '2026-11-25T12:00:00.000Z',
    actionRecommendation: {
        entryPrices: [178, 181.5],
        stopLoss: 170,
        takeProfitPrices: [200],
    },
};

async function propose(
    args: Record<string, unknown>,
    userId = MEMBER,
    emit = true,
    locale: 'ko' | 'en' = 'ko'
) {
    const { runtime, emitted } = makeRuntime(emit);
    const result = (await proposePriceAlertTool(
        args,
        ctxFor(userId, locale),
        runtime
    )) as Record<string, unknown>;
    await Promise.resolve();
    return { result, emitted };
}

describe('proposePriceAlertTool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(NOW);
        m.secret.value = SECRET;
        m.profile.mockResolvedValue('us-equity');
        m.asset.mockResolvedValue({
            symbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: '애플',
        });
        m.getQuote.mockResolvedValue({
            price: 190,
            changesPercentage: 0.5,
            timestamp: Math.floor(NOW.getTime() / 1000) - 60,
        });
        // 시작 세션(11-24)의 일봉 종가 — 카드의 기준 종가이자 발송기 분할 판정이 견주는 값이다.
        m.bars.mockResolvedValue({
            bars: [
                {
                    time: Date.parse('2026-11-24T00:00:00Z') / 1000,
                    open: 188,
                    high: 188,
                    low: 188,
                    close: 188,
                    volume: 1,
                },
            ],
        });
        m.peek.mockResolvedValue({ cached: { result: PLAN } });
        m.listForSubscriber.mockResolvedValue([]);
    });
    afterEach(() => vi.useRealTimers());

    describe('가격 기준', () => {
        it('영문 이름이 티커와 같으면 카드 이름은 null(코드만 보인다)', async () => {
            m.asset.mockResolvedValue({ symbol: 'AAPL', name: 'AAPL' });

            const { emitted } = await propose(
                { symbol: 'AAPL', basis: 'price_below', price: 180 },
                MEMBER,
                true,
                'en'
            );

            const block = emitted[0]?.block;
            if (!isChatPriceAlertProposalBlock(block)) throw new Error('block');
            expect(block.name).toBeNull();
        });

        it('영문 로케일에서 영문 이름이 티커와 같고 한글명이 있으면 한글명을 쓴다(사이트 공통 pickAssetName 규칙)', async () => {
            m.asset.mockResolvedValue({
                symbol: 'AAPL',
                name: 'AAPL',
                koreanName: '애플',
            });

            const { emitted } = await propose(
                { symbol: 'AAPL', basis: 'price_below', price: 180 },
                MEMBER,
                true,
                'en'
            );

            const block = emitted[0]?.block;
            if (!isChatPriceAlertProposalBlock(block)) throw new Error('block');
            expect(block.name).toBe('애플');
        });

        it('가격 아래 알림을 제안만 한다 — 서명된 카드를 내고, 저장소에는 쓰지 않는다', async () => {
            const { result, emitted } = await propose({
                symbol: 'aapl',
                basis: 'price_below',
                price: 180,
            });

            expect(result).toMatchObject({
                status: 'proposed',
                symbol: 'AAPL',
                condition: 'close_below',
                level: 180,
                basis: 'price_level',
                currentPrice: 190,
                lastClose: 188,
                requiresUserConfirmation: true,
            });
            expect(result.notes).toEqual([
                expect.stringContaining('Never say the alert is set'),
            ]);
            expect(emitted).toHaveLength(1);
            const block = emitted[0]?.block;
            expect(isChatPriceAlertProposalBlock(block)).toBe(true);
            if (!isChatPriceAlertProposalBlock(block)) return;
            expect(block.name).toBe('애플');
            // 토큰이 담은 제안과 카드의 제안이 같고, 서명은 이 서버의 비밀로만 맞는다.
            expect(verifyPriceAlertProposal(SECRET, block.token)).toEqual(
                block.proposal
            );
            expect(
                verifyPriceAlertProposal(`${SECRET}x`, block.token)
            ).toBeNull();
            expect(block.proposal).toMatchObject({
                symbol: 'AAPL',
                market: 'us',
                condition: { kind: 'close_below', level: 180 },
                basis: 'price_level',
                analysisAt: null,
                referenceClose: 188,
                startsAfterSession: '2026-11-24',
                expiresOn: '2026-12-24',
                subject: priceAlertSubject(SECRET, MEMBER),
                exp: Math.floor(NOW.getTime() / 1000) + 86_400,
            });
        });

        it('가격 위 알림은 close_above다', async () => {
            const { result } = await propose({
                symbol: 'AAPL',
                basis: 'price_above',
                price: 200,
            });

            expect(result).toMatchObject({
                status: 'proposed',
                condition: 'close_above',
                level: 200,
            });
        });

        it('영어 대화면 카드 이름은 영문명이다', async () => {
            const { emitted } = await propose(
                { symbol: 'AAPL', basis: 'price_below', price: 180 },
                MEMBER,
                true,
                'en'
            );

            expect(
                emitted[0]?.block !== null &&
                    emitted[0]?.block !== undefined &&
                    'name' in emitted[0].block
                    ? emitted[0].block.name
                    : undefined
            ).toBe('Apple Inc.');
        });

        it('말한 가격이 시세의 ×0.5~×2 밖이면 out_of_range, 경계는 받는다', async () => {
            const low = await propose({
                symbol: 'AAPL',
                basis: 'price_below',
                price: 94.99,
            });
            const high = await propose({
                symbol: 'AAPL',
                basis: 'price_above',
                price: 380.01,
            });
            const lowEdge = await propose({
                symbol: 'AAPL',
                basis: 'price_below',
                price: 95,
            });
            const highEdge = await propose({
                symbol: 'AAPL',
                basis: 'price_above',
                price: 380,
            });

            expect(low.result).toEqual({ error: 'out_of_range' });
            expect(high.result).toEqual({ error: 'out_of_range' });
            expect(lowEdge.result).toMatchObject({ status: 'proposed' });
            expect(highEdge.result).toMatchObject({ status: 'proposed' });
        });

        it('이미 그 자리를 넘은 가격은 already_met이고 카드를 내지 않는다', async () => {
            const { result, emitted } = await propose({
                symbol: 'AAPL',
                basis: 'price_below',
                price: 195,
            });

            expect(result).toMatchObject({
                error: 'already_met',
                reason: 'met',
                currentPrice: 190,
            });
            expect(emitted).toHaveLength(0);
        });

        it.each([
            [{ symbol: 'AAPL', basis: 'price_below' }],
            [{ symbol: 'AAPL', basis: 'price_above', price: 0 }],
            [{ symbol: 'AAPL', basis: 'price_below', price: -5 }],
            [{ symbol: 'AAPL', basis: 'price_below', price: '180' }],
            [{ symbol: 'AAPL', basis: 'buy_below', price: 180 }],
            [{ basis: 'price_below', price: 180 }],
        ])('잘못된 인자 %j → invalid_args', async args => {
            const { result, emitted } = await propose(args);

            expect(result).toEqual({ error: 'invalid_args' });
            expect(emitted).toHaveLength(0);
            expect(m.getQuote).not.toHaveBeenCalled();
        });
    });

    describe('기준 종가', () => {
        it('장중 시세가 전일 대비 +70%여도 기준 종가는 시작 세션의 종가다 — 발송기 분할 판정과 같은 척도', async () => {
            m.getQuote.mockResolvedValue({
                price: 319.6,
                changesPercentage: 70,
                timestamp: Math.floor(NOW.getTime() / 1000) - 60,
            });

            const { result, emitted } = await propose({
                symbol: 'AAPL',
                basis: 'price_above',
                price: 400,
            });

            expect(result).toMatchObject({
                status: 'proposed',
                currentPrice: 319.6,
                lastClose: 188,
            });
            const block = emitted[0]?.block;
            if (!isChatPriceAlertProposalBlock(block)) throw new Error('block');
            expect(block.proposal.referenceClose).toBe(188);
            // 발송기: 일봉의 그 세션 종가 188 / 저장된 기준 종가 188 = 1 → 분할로 오인되지 않는다.
            expect(188 / block.proposal.referenceClose).toBe(1);
        });

        it('이미 충족 판정은 지금 시세로 한다(기준 종가가 아니다)', async () => {
            m.getQuote.mockResolvedValue({
                price: 170,
                changesPercentage: -9,
                timestamp: Math.floor(NOW.getTime() / 1000) - 60,
            });

            const { result } = await propose({
                symbol: 'AAPL',
                basis: 'price_below',
                price: 175,
            });

            expect(result).toMatchObject({
                error: 'already_met',
                currentPrice: 170,
            });
        });
    });

    describe('분석 기준', () => {
        it('진입 구간은 저장된 분석에서 읽고, 시세가 구간 위면 from_above 구간 알림이다', async () => {
            const { result, emitted } = await propose({
                symbol: 'AAPL',
                basis: 'analysis_entry_zone',
            });

            expect(result).toMatchObject({
                status: 'proposed',
                condition: 'enter_zone',
                low: 178,
                high: 181.5,
                basis: 'analysis_entry_zone',
                analysisAt: PLAN.analyzedAt,
            });
            expect(result.firesWhen).toContain(
                'at or below the top of the zone'
            );
            const block = emitted[0]?.block;
            expect(isChatPriceAlertProposalBlock(block)).toBe(true);
            if (!isChatPriceAlertProposalBlock(block)) return;
            expect(block.proposal.condition).toEqual({
                kind: 'enter_zone',
                low: 178,
                high: 181.5,
                approach: 'from_above',
            });
            expect(block.proposal.analysisAt).toBe(PLAN.analyzedAt);
        });

        it('시세가 구간 아래면 from_below, 구간 안이면 already_met(inside)이다', async () => {
            m.getQuote.mockResolvedValue({ price: 150, changesPercentage: 0 });
            const below = await propose({
                symbol: 'AAPL',
                basis: 'analysis_entry_zone',
            });
            m.getQuote.mockResolvedValue({ price: 180, changesPercentage: 0 });
            const inside = await propose({
                symbol: 'AAPL',
                basis: 'analysis_entry_zone',
            });

            expect(below.result.firesWhen).toContain('at or above the bottom');
            expect(inside.result).toMatchObject({
                error: 'already_met',
                reason: 'inside',
            });
        });

        it('무효화 기준은 분석의 유효 손절가(close_below)다', async () => {
            const { result } = await propose({
                symbol: 'AAPL',
                basis: 'analysis_invalidation',
            });

            expect(result).toMatchObject({
                status: 'proposed',
                condition: 'close_below',
                level: 170,
                basis: 'analysis_invalidation',
            });
        });

        it('분석 기준에 price를 주면 invalid_args다 — 모델이 분석 가격대를 직접 적지 못한다', async () => {
            const { result, emitted } = await propose({
                symbol: 'AAPL',
                basis: 'analysis_entry_zone',
                price: 100,
            });

            expect(result).toEqual({ error: 'invalid_args' });
            expect(emitted).toHaveLength(0);
            expect(m.peek).not.toHaveBeenCalled();
        });

        it('같은 peek을 호출자 컨텍스트로 부른다(일봉, 시세 심볼)', async () => {
            m.asset.mockResolvedValue({
                symbol: 'AAPL',
                name: 'Apple',
                fmpSymbol: 'AAPL',
            });

            await propose({ symbol: 'AAPL', basis: 'analysis_invalidation' });

            expect(m.peek).toHaveBeenCalledWith(
                'AAPL',
                '1Day',
                'AAPL',
                expect.objectContaining({ userId: MEMBER }),
                expect.objectContaining({ analysisModel: expect.any(String) })
            );
        });

        it('캐시된 분석이 없으면 no_analysis', async () => {
            m.peek.mockResolvedValue(null);

            const { result } = await propose({
                symbol: 'AAPL',
                basis: 'analysis_entry_zone',
            });

            expect(result).toEqual({ error: 'no_analysis' });
        });

        it('분석 시각이 없는 옛 항목은 no_analysis(날짜를 카드에 못 쓴다)', async () => {
            m.peek.mockResolvedValue({
                cached: {
                    result: { actionRecommendation: PLAN.actionRecommendation },
                },
            });

            const { result } = await propose({
                symbol: 'AAPL',
                basis: 'analysis_entry_zone',
            });

            expect(result).toEqual({ error: 'no_analysis' });
        });

        it('계획이 잠긴 호출자(actionRecommendation null)는 levels_locked이고 결과에 숫자가 없다', async () => {
            m.peek.mockResolvedValue({
                cached: {
                    result: {
                        analyzedAt: PLAN.analyzedAt,
                        actionRecommendation: null,
                    },
                },
            });

            const { result, emitted } = await propose(
                { symbol: 'AAPL', basis: 'analysis_entry_zone' },
                GUEST
            );

            expect(result).toEqual({ error: 'levels_locked' });
            expect(JSON.stringify(result)).not.toMatch(/\d/);
            expect(emitted).toHaveLength(0);
        });

        it('계획에 진입가가 없으면 no_level, 손절가가 구간 위면 무효화 기준은 no_level', async () => {
            m.peek.mockResolvedValue({
                cached: {
                    result: {
                        analyzedAt: PLAN.analyzedAt,
                        actionRecommendation: { takeProfitPrices: [200] },
                    },
                },
            });
            const noZone = await propose({
                symbol: 'AAPL',
                basis: 'analysis_entry_zone',
            });
            m.peek.mockResolvedValue({
                cached: {
                    result: {
                        analyzedAt: PLAN.analyzedAt,
                        actionRecommendation: {
                            entryPrices: [178, 181.5],
                            stopLoss: 185,
                        },
                    },
                },
            });
            const stopAboveZone = await propose({
                symbol: 'AAPL',
                basis: 'analysis_invalidation',
            });

            expect(noZone.result).toEqual({ error: 'no_level' });
            expect(stopAboveZone.result).toEqual({ error: 'no_level' });
        });

        it('이미 무효화 기준 아래에 있으면 already_met', async () => {
            m.getQuote.mockResolvedValue({ price: 165, changesPercentage: 0 });

            const { result } = await propose({
                symbol: 'AAPL',
                basis: 'analysis_invalidation',
            });

            expect(result).toMatchObject({
                error: 'already_met',
                reason: 'met',
            });
        });
    });

    describe('시장과 시세', () => {
        it('한국 종목은 kr 시장·한국 캘린더로 제안한다', async () => {
            m.profile.mockResolvedValue('kr-equity');
            m.asset.mockResolvedValue({
                symbol: '005930.KS',
                name: 'Samsung Electronics',
                koreanName: '삼성전자',
                fmpSymbol: '005930.KS',
            });
            m.getQuote.mockResolvedValue({
                price: 70_000,
                changesPercentage: 0,
                timestamp: Math.floor(NOW.getTime() / 1000) - 60,
            });
            // 한국 시작 세션은 11-25다.
            m.bars.mockResolvedValue({
                bars: [
                    {
                        time: Date.parse('2026-11-25T00:00:00Z') / 1000,
                        open: 69_000,
                        high: 69_000,
                        low: 69_000,
                        close: 69_000,
                        volume: 1,
                    },
                ],
            });

            const { result, emitted } = await propose({
                symbol: '005930.ks',
                basis: 'price_below',
                price: 65_000,
            });

            expect(result).toMatchObject({
                status: 'proposed',
                symbol: '005930.KS',
            });
            expect(m.getQuote).toHaveBeenCalledWith('005930.KS');
            const block = emitted[0]?.block;
            if (!isChatPriceAlertProposalBlock(block)) throw new Error('block');
            // 11-26(목) 00:00 KST — 한국 장은 11-25(수) 15:30에 마감해 그날 세션이 마지막으로 마감된 세션이다.
            expect(block.proposal).toMatchObject({
                market: 'kr',
                startsAfterSession: '2026-11-25',
                referenceClose: 69_000,
            });
            expect(block.name).toBe('삼성전자');
        });

        it('암호화폐 등 미국·한국 주식이 아니면 unsupported_symbol, 시세도 읽지 않는다', async () => {
            m.profile.mockResolvedValue('crypto');

            const { result } = await propose({
                symbol: 'BTCUSD',
                basis: 'price_below',
                price: 50_000,
            });

            expect(result).toEqual({ error: 'unsupported_symbol' });
            expect(m.getQuote).not.toHaveBeenCalled();
        });

        it.each([
            ['시세 없음', null],
            ['0 이하 가격', { price: 0, changesPercentage: 0 }],
            ['유한하지 않은 가격', { price: Number.NaN, changesPercentage: 0 }],
        ])('%s → quote_unavailable', async (_label, quote) => {
            m.getQuote.mockResolvedValue(quote);

            const { result, emitted } = await propose({
                symbol: 'AAPL',
                basis: 'price_below',
                price: 180,
            });

            expect(result).toEqual({ error: 'quote_unavailable' });
            expect(emitted).toHaveLength(0);
        });

        it('낡은 한국 리스팅 시세는 기준 가격이 아니다', async () => {
            m.profile.mockResolvedValue('kr-equity');
            m.getQuote.mockResolvedValue({
                price: 70_000,
                changesPercentage: 0,
                timestamp: Math.floor(NOW.getTime() / 1000) - 40 * 86_400,
            });

            const { result } = await propose({
                symbol: '005930.KS',
                basis: 'price_below',
                price: 65_000,
            });

            expect(result).toEqual({ error: 'quote_unavailable' });
        });

        it('시세 시각이 없으면 quoteAt은 null이다', async () => {
            m.getQuote.mockResolvedValue({ price: 190, changesPercentage: 0 });

            const { emitted } = await propose({
                symbol: 'AAPL',
                basis: 'price_below',
                price: 180,
            });

            const block = emitted[0]?.block;
            if (!isChatPriceAlertProposalBlock(block)) throw new Error('block');
            expect(block.proposal.quoteAt).toBeNull();
        });
    });

    describe('상한과 중복(회원만 미리 본다)', () => {
        const live = (level: number) => ({
            symbol: 'AAPL',
            market: 'us',
            expiresOn: '2026-12-24',
            status: 'active',
            condition: { kind: 'close_below', level },
        });

        it('살아 있는 알림이 10개면 limit_reached', async () => {
            m.listForSubscriber.mockResolvedValue(
                Array.from({ length: 10 }, (_, i) => ({
                    ...live(100 + i),
                    symbol: `S${i}`,
                }))
            );

            const { result, emitted } = await propose({
                symbol: 'AAPL',
                basis: 'price_below',
                price: 180,
            });

            expect(result).toEqual({ error: 'limit_reached' });
            expect(emitted).toHaveLength(0);
            expect(m.listForSubscriber).toHaveBeenCalledWith({
                kind: 'member',
                userId: MEMBER,
            });
        });

        it('같은 종목·조건·가격의 살아 있는 알림이 있으면 exists, 이미 알린 알림은 세지 않는다', async () => {
            m.listForSubscriber.mockResolvedValue([live(180)]);
            const same = await propose({
                symbol: 'AAPL',
                basis: 'price_below',
                price: 180,
            });
            m.listForSubscriber.mockResolvedValue([
                { ...live(180), status: 'fired' },
                live(175),
            ]);
            const other = await propose({
                symbol: 'AAPL',
                basis: 'price_below',
                price: 180,
            });

            expect(same.result).toEqual({ error: 'exists' });
            expect(other.result).toMatchObject({ status: 'proposed' });
        });

        it('만료 세션이 기대 세션보다 앞선 알림은 세지 않는다(발송기와 같은 규칙)', async () => {
            // NOW의 미국 기대 세션은 11-24다. 11-23이 만료인 알림은 이미 판정이 끝났다.
            m.listForSubscriber.mockResolvedValue([
                {
                    ...live(180),
                    market: 'us',
                    expiresOn: '2026-11-23',
                },
                ...Array.from({ length: 9 }, (_, i) => ({
                    ...live(100 + i),
                    symbol: `S${i}`,
                    market: 'us',
                    expiresOn: '2026-11-24',
                })),
            ]);

            const { result } = await propose({
                symbol: 'AAPL',
                basis: 'price_below',
                price: 180,
            });

            // 만료된 같은 가격 알림은 exists가 아니고, 살아 있는 9개만 세어 상한(10)에 닿지 않는다.
            expect(result).toMatchObject({ status: 'proposed' });
        });

        it('비회원은 저장소를 읽지 않는다(구독자 행은 서명된 쿠키가 가리킨다)', async () => {
            const { result } = await propose(
                { symbol: 'AAPL', basis: 'price_below', price: 180 },
                GUEST
            );

            expect(result).toMatchObject({ status: 'proposed' });
            expect(m.repoCtor).not.toHaveBeenCalled();
            expect(m.listForSubscriber).not.toHaveBeenCalled();
        });

        it('비회원 카드의 소유자 해시는 게스트 주체로 만든다', async () => {
            const { emitted } = await propose(
                { symbol: 'AAPL', basis: 'price_below', price: 180 },
                GUEST
            );

            const block = emitted[0]?.block;
            if (!isChatPriceAlertProposalBlock(block)) throw new Error('block');
            expect(block.proposal.subject).toBe(
                priceAlertSubject(SECRET, GUEST)
            );
            expect(block.proposal.subject).not.toBe(
                priceAlertSubject(SECRET, MEMBER)
            );
        });

        it('저장소 읽기가 실패해도 제안은 막지 않는다(만들기 버튼이 같은 검사를 다시 한다)', async () => {
            m.listForSubscriber.mockRejectedValue(new Error('db down'));
            vi.spyOn(console, 'warn').mockImplementation(() => undefined);

            const { result } = await propose({
                symbol: 'AAPL',
                basis: 'price_below',
                price: 180,
            });

            expect(result).toMatchObject({ status: 'proposed' });
        });
    });

    describe('실행할 수 없는 환경', () => {
        it('카드를 받아 줄 곳(emitChart)이 없으면 unavailable — 만들었다고 말할 길을 막는다', async () => {
            const { result } = await propose(
                { symbol: 'AAPL', basis: 'price_below', price: 180 },
                MEMBER,
                false
            );

            expect(result).toEqual({ error: 'unavailable' });
            expect(m.getQuote).not.toHaveBeenCalled();
        });

        it('서명 비밀이 없으면 unavailable', async () => {
            m.secret.value = null;

            const { result, emitted } = await propose({
                symbol: 'AAPL',
                basis: 'price_below',
                price: 180,
            });

            expect(result).toEqual({ error: 'unavailable' });
            expect(emitted).toHaveLength(0);
        });

        it('클라이언트 가드를 통과하지 못하는 카드는 내지 않고 unavailable이다', async () => {
            vi.spyOn(console, 'warn').mockImplementation(() => undefined);

            const { result, emitted } = await propose({
                symbol: 'A B',
                basis: 'price_below',
                price: 180,
            });

            expect(result).toEqual({ error: 'unavailable' });
            expect(emitted).toHaveLength(0);
        });
    });
});
