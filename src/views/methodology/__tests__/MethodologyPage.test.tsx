import { screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import {
    computeFearGreedIndex,
    CRYPTO_FEAR_GREED_FACTOR_KEYS,
    FEAR_GREED_LABEL_CUTOFFS,
    MARKET_FEAR_GREED_FACTOR_KEYS,
    POC_WINDOW_DEFAULT,
    type Bar,
    type BuySellVolumeResult,
} from '@y0ngha/siglens-core';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { CRYPTO_DESCRIPTOR } from '@/shared/config/marketProfile/crypto';
import { KR_EQUITY_DESCRIPTOR } from '@/shared/config/marketProfile/krEquity';
import { US_EQUITY_DESCRIPTOR } from '@/shared/config/marketProfile/usEquity';
import { SITE_OPERATOR } from '@/shared/lib/legal';
import ko from '../../../../messages/ko.json';

vi.mock('next-intl/server', () => ({
    getTranslations: vi.fn(
        async ({ namespace }: { locale: string; namespace: string }) =>
            createTranslator({ locale: 'ko', messages: ko, namespace } as never)
    ),
}));

import { MethodologyPage } from '../MethodologyPage';
import { METHODOLOGY_CHANGELOG } from '../lib/methodologyChangelog';
import { METHODOLOGY_UPDATED_AT } from '@/shared/lib/legal';

const m = ko.views.methodology;

const COUNTS = {
    indicators: 39,
    candlesticks: 8,
    patterns: 17,
    strategies: 8,
    supportResistance: 3,
    fundamental: 2,
    news: 1,
};

const SECTION_IDS = [
    'overview',
    'data',
    'indicators',
    'fear-greed',
    'ai',
    'backtesting',
    'limits',
    'corrections',
    'changelog',
] as const;

async function renderPage() {
    renderWithIntl(
        await MethodologyPage({
            locale: 'ko',
            title: ko.shared.seo.methodology.title,
            counts: COUNTS,
            updatedAt: '2026년 10월 4일',
        })
    );
}

/** `FearGreedSnapshot`을 만들 만큼의 합성 일봉. 결정적이다(난수 없음). */
function syntheticDailyBars(count: number): {
    bars: Bar[];
    buySellVolume: BuySellVolumeResult[];
} {
    const bars = Array.from({ length: count }, (_, i): Bar => {
        const close = 100 + Math.sin(i / 7) * 5 + i * 0.05;
        return {
            time: 1_700_000_000 + i * 86_400,
            open: close - 0.4,
            high: close + 1.2,
            low: close - 1.1,
            close,
            volume: 1_000 + ((i * 37) % 200),
        };
    });
    const buySellVolume = bars.map((b, i): BuySellVolumeResult => ({
        buyVolume: b.volume * (0.4 + ((i % 5) / 5) * 0.3),
        sellVolume: b.volume * (0.6 - ((i % 5) / 5) * 0.3),
    }));
    return { bars, buySellVolume };
}

/** `#data` 섹션 안의 시장 카드. 제목이 다른 섹션(공포·탐욕의 '암호화폐')과 겹쳐 범위를 좁힌다. */
function marketCard(name: string): HTMLElement {
    const section = document.getElementById('data')!.closest('section')!;
    return within(section).getByRole('heading', { name }).closest('li')!;
}

describe('MethodologyPage', () => {
    it('lays out one h1 and the nine sections in order', async () => {
        await renderPage();
        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
            m.hero.title
        );
        expect(
            screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)
        ).toEqual([
            m.overview.title,
            m.data.title,
            m.indicators.title,
            m.fearGreed.title,
            m.ai.title,
            m.backtesting.title,
            m.limits.title,
            m.corrections.title,
            m.changelog.title,
        ]);
    });

    describe('section anchors', () => {
        it('every stable id is the id of its own h2', async () => {
            await renderPage();
            for (const id of SECTION_IDS) {
                const target = document.getElementById(id);
                expect(target, `#${id}`).not.toBeNull();
                expect(target?.tagName).toBe('H2');
            }
        });

        it('the table of contents links to every section id', async () => {
            await renderPage();
            const toc = screen.getByRole('navigation', { name: m.toc.label });
            const hrefs = within(toc)
                .getAllByRole('link')
                .map(a => a.getAttribute('href'));
            expect(hrefs).toEqual(SECTION_IDS.map(id => `#${id}`));
        });

        it('keeps the ids the provenance note links to (#ai, #fear-greed)', async () => {
            await renderPage();
            expect(document.getElementById('ai')).not.toBeNull();
            expect(document.getElementById('fear-greed')).not.toBeNull();
        });
    });

    describe('data sources', () => {
        /**
         * 이 페이지의 출처 문구는 마켓 프로필이 실제로 쓰는 값과 같아야 한다.
         * 프로필이 바뀌면(예: KR 시세 공급자 교체) 이 테스트가 먼저 깨져 문구를
         * 같이 고치게 한다.
         */
        it('matches the market profiles the code really uses', () => {
            expect(US_EQUITY_DESCRIPTOR.dataProvider).toBe('fmp');
            expect(US_EQUITY_DESCRIPTOR.newsSource).toBe('stock');
            expect(KR_EQUITY_DESCRIPTOR.dataProvider).toBe('yahoo');
            expect(KR_EQUITY_DESCRIPTOR.newsSource).toBe('naver');
            expect(CRYPTO_DESCRIPTOR.dataProvider).toBe('fmp');
            expect(CRYPTO_DESCRIPTOR.newsSource).toBe('crypto');
        });

        it('lists each market with its provider rows', async () => {
            await renderPage();
            const kr = marketCard(m.data.marketKr);
            expect(kr).toHaveTextContent(m.data.yahoo);
            expect(kr).toHaveTextContent(m.data.naver);
            expect(kr).toHaveTextContent(m.data.krOther);
            const us = marketCard(m.data.marketUs);
            expect(us).toHaveTextContent(m.data.fmp);
            expect(us).toHaveTextContent(m.data.usOther);
            const crypto = marketCard(m.data.marketCrypto);
            expect(crypto).toHaveTextContent(m.data.fmp);
        });

        it('states the quote delay each profile declares', async () => {
            expect(US_EQUITY_DESCRIPTOR.quoteDelayMinutes).toBe(0);
            expect(CRYPTO_DESCRIPTOR.quoteDelayMinutes).toBe(0);
            expect(KR_EQUITY_DESCRIPTOR.quoteDelayMinutes).toBe(20);
            expect(m.data.delayKr).toContain(
                String(KR_EQUITY_DESCRIPTOR.quoteDelayMinutes)
            );
            await renderPage();
            const kr = marketCard(m.data.marketKr);
            expect(kr).toHaveTextContent(m.data.delayKr);
        });

        it('does not claim financials for crypto, which has no such tab', async () => {
            expect(CRYPTO_DESCRIPTOR.tabs).not.toContain('financials');
            await renderPage();
            const crypto = marketCard(m.data.marketCrypto);
            expect(crypto).not.toHaveTextContent(m.data.rowFinancials);
        });
    });

    it('interpolates the live skill counts and leaves no placeholder', async () => {
        await renderPage();
        expect(
            screen.getByText(
                '분석 기준으로 쓰는 보조지표는 39종, 캔들 패턴은 8종, 차트 패턴은 17종, 전략은 8종이에요.'
            )
        ).toBeInTheDocument();
        expect(document.body.textContent).not.toMatch(/\{\w+\}/);
    });

    describe('indicators', () => {
        it('gives four worked examples', async () => {
            await renderPage();
            for (const term of [m.indicators.ma, m.indicators.rsi]) {
                expect(screen.getByText(term)).toBeInTheDocument();
            }
            expect(screen.getByText(m.indicators.macd)).toBeInTheDocument();
            expect(
                screen.getByText(m.indicators.bollinger)
            ).toBeInTheDocument();
        });

        it('says chart patterns are screened by rules but confirmed by the AI', async () => {
            await renderPage();
            const section = document
                .getElementById('indicators')!
                .closest('section')!;
            expect(section).toHaveTextContent(m.indicators.rules);
            expect(m.indicators.rules).toContain('AI가 실제 모양을 보고');
        });
    });

    describe('fear and greed', () => {
        it('names every factor the symbol score really uses', async () => {
            const { bars, buySellVolume } = syntheticDailyBars(320);
            const snapshot = computeFearGreedIndex(bars, buySellVolume);
            expect(snapshot).not.toBeNull();
            const keys = snapshot!.groups.flatMap(g =>
                g.factors.map(f => f.key)
            );
            expect(keys.toSorted()).toEqual(
                [
                    'buysell_imbalance',
                    'ma200_distance',
                    'poc_distance',
                    'range_position',
                    'volume_z',
                ].toSorted()
            );

            const body = m.fearGreed.symbolBody;
            expect(body).toContain('거래량');
            expect(body).toContain('매수와 매도 거래량');
            expect(body).toContain(`최근 ${POC_WINDOW_DEFAULT}개 봉`);
            expect(body).toContain('200개 봉 평균');
            expect(body).toContain('252개 봉');
        });

        it('counts the market and crypto factors from core', () => {
            expect(MARKET_FEAR_GREED_FACTOR_KEYS).toHaveLength(5);
            expect(m.fearGreed.usBody.startsWith('다섯 가지')).toBe(true);
            expect(m.fearGreed.krBody.startsWith('다섯 가지')).toBe(true);
            expect(CRYPTO_FEAR_GREED_FACTOR_KEYS).toHaveLength(6);
            expect(m.fearGreed.cryptoBody.startsWith('여섯 가지')).toBe(true);
        });

        it('states the label boundaries core uses', async () => {
            await renderPage();
            const c = FEAR_GREED_LABEL_CUTOFFS;
            expect(
                screen.getByText(
                    `점수는 다섯 단계로 나눠요. ${c.EXTREME_FEAR_MAX} 미만은 극심한 공포, ${c.EXTREME_FEAR_MAX} 이상 ${c.FEAR_MAX} 미만은 공포, ${c.FEAR_MAX} 이상 ${c.NEUTRAL_MAX} 미만은 중립, ${c.NEUTRAL_MAX} 이상 ${c.GREED_MAX} 미만은 탐욕, ${c.GREED_MAX} 이상은 극심한 탐욕이에요.`
                )
            ).toBeInTheDocument();
        });

        it('says it is rule-based and not a forecast', async () => {
            await renderPage();
            expect(screen.getByText(m.fearGreed.sub)).toBeInTheDocument();
            expect(m.fearGreed.sub).toContain('AI가 쓰지 않아요');
            expect(m.fearGreed.sub).toContain('앞으로의 가격을 말하지 않아요');
        });

        it('does not publish weights (2026-10-04 decision)', async () => {
            await renderPage();
            const section = document
                .getElementById('fear-greed')!
                .closest('section')!;
            const text = section.textContent ?? '';
            expect(text).not.toMatch(/가중치/);
            expect(text).not.toMatch(/같은 비중|동일 비중|균등|%/);
            expect(text).not.toMatch(/[0-9.]+\s*배/);
        });

        it('links the three market indexes', async () => {
            await renderPage();
            expect(
                screen.getByRole('link', { name: m.fearGreed.linkUs })
            ).toHaveAttribute('href', '/fear-greed');
            expect(
                screen.getByRole('link', { name: m.fearGreed.linkKr })
            ).toHaveAttribute('href', '/fear-greed/kr');
            expect(
                screen.getByRole('link', { name: m.fearGreed.linkCrypto })
            ).toHaveAttribute('href', '/fear-greed/crypto');
        });
    });

    describe('AI section', () => {
        it('names the four providers and says no person reviews each text', async () => {
            await renderPage();
            expect(m.ai.do1).toMatch(/OpenAI.*Anthropic.*Google.*DeepSeek/);
            expect(screen.getByText(m.ai.do1)).toBeInTheDocument();
            expect(screen.getByText(m.ai.dont4)).toBeInTheDocument();
            expect(m.ai.dont4).toContain(
                '사람이 한 편씩 읽고 고친 뒤에 보여주지는 않아요'
            );
        });

        it('describes the plain-text check and the no-instruction rule', async () => {
            await renderPage();
            expect(screen.getByText(m.ai.check)).toBeInTheDocument();
            expect(screen.getByText(m.ai.dont3)).toBeInTheDocument();
            expect(screen.getByText(m.ai.levels)).toBeInTheDocument();
        });
    });

    describe('backtesting', () => {
        it('links /backtesting from the indicators and backtesting sections', async () => {
            await renderPage();
            const links = [
                screen.getByRole('link', { name: m.indicators.backtest }),
                screen.getByRole('link', { name: m.backtesting.link }),
            ];
            for (const link of links) {
                expect(link).toHaveAttribute('href', '/backtesting');
            }
        });

        it('states the limits the backtesting page itself states', async () => {
            await renderPage();
            const section = document
                .getElementById('backtesting')!
                .closest('section')!;
            expect(section).toHaveTextContent(
                '수수료와 슬리피지는 넣지 않았고'
            );
            expect(section).toHaveTextContent(
                '앞으로의 성과를 보장하지 않아요'
            );
            expect(ko.widgets.backtesting.methodology.noCosts).toContain(
                '수수료와 슬리피지'
            );
        });
    });

    it('lists the limits and the report channels', async () => {
        await renderPage();
        for (const line of [
            m.limits.wrong,
            m.limits.past,
            m.limits.personal,
            m.limits.variance,
            m.limits.levels,
        ]) {
            expect(screen.getByText(line)).toBeInTheDocument();
        }
        expect(
            screen.getByRole('link', { name: m.corrections.emailLabel })
        ).toHaveAttribute('href', `mailto:${SITE_OPERATOR.email}`);
        expect(
            screen.getByRole('link', { name: m.corrections.aboutLink })
        ).toHaveAttribute('href', '/about');
    });

    describe('changelog', () => {
        it('renders every entry newest first with a machine-readable date', async () => {
            await renderPage();
            const section = document
                .getElementById('changelog')!
                .closest('section')!;
            const times = within(section).getAllByRole('listitem');
            expect(times).toHaveLength(METHODOLOGY_CHANGELOG.length);
            const dates = [...section.querySelectorAll('time')].map(el =>
                el.getAttribute('dateTime')
            );
            expect(dates).toEqual(METHODOLOGY_CHANGELOG.map(e => e.date));
            expect(dates).toEqual(dates.toSorted().toReversed());
            for (const entry of METHODOLOGY_CHANGELOG) {
                expect(
                    within(section).getByText(m.changelog[entry.key])
                ).toBeInTheDocument();
            }
        });

        it('has a newest entry dated the same KST day as METHODOLOGY_UPDATED_AT', () => {
            const kstDay = new Date(
                METHODOLOGY_UPDATED_AT.getTime() + 9 * 60 * 60 * 1000
            )
                .toISOString()
                .slice(0, 10);
            expect(METHODOLOGY_CHANGELOG[0]?.date).toBe(kstDay);
        });
    });

    it('ends with the last-updated line and the investment disclaimer', async () => {
        await renderPage();
        expect(
            screen.getByText('마지막 업데이트: 2026년 10월 4일')
        ).toBeInTheDocument();
        expect(screen.getByRole('note').textContent).toBe(
            ko.shared.lib.legal.investmentDisclaimer
        );
    });

    it('never prints an unreplaced placeholder or raw catalog key', async () => {
        await renderPage();
        const text = document.body.textContent ?? '';
        expect(text).not.toMatch(/views\.methodology|changelog\./);
    });

    it('indicators section links to the indicator chart guide', async () => {
        await renderPage();
        const link = screen.getByRole('link', { name: m.indicators.guide });
        expect(link).toHaveAttribute('href', '/guide/indicators');
    });
});
