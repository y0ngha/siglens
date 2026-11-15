import { screen, within } from '@testing-library/react';
import type { Locale } from '@/shared/i18n/locales';
import { formatKoreanDateTime } from '@/shared/lib/formatKoreanDateTime';
import { formatSignedPercent } from '@/shared/lib/priceFormat';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import ko from '../../../../../../messages/ko.json';
import en from '../../../../../../messages/en.json';
import { HomeTodayMarket } from '../HomeTodayMarket';
import type { HomeTodayMarketData } from '../../_lib/loadHomeTodayMarket';
import { toTodayMarketView } from '../../_lib/todayMarketView';

const c = ko.app.home.todayMarket;
const US_SCANNED_AT = '2026-11-14T21:00:00.000Z';

const FULL: HomeTodayMarketData = {
    fearGreed: {
        us: { date: '2026-11-13', score: 45.6, label: 'NEUTRAL' },
        kr: { date: '2026-11-14', score: 20, label: 'EXTREME_FEAR' },
        crypto: { date: '2026-11-15', score: 70, label: 'GREED' },
    },
    signals: {
        us: {
            computedAt: US_SCANNED_AT,
            rows: [
                {
                    symbol: 'NVDA',
                    koreanName: '엔비디아',
                    changePercent: 2.5,
                    signalType: 'golden_cross',
                    expected: false,
                },
            ],
        },
        kr: {
            computedAt: null,
            rows: [
                {
                    symbol: '005930.KS',
                    koreanName: '삼성전자',
                    changePercent: -1.2,
                    signalType: 'rsi_bullish_divergence',
                    expected: true,
                },
            ],
        },
    },
};

function renderSection(
    data: HomeTodayMarketData = FULL,
    locale: Locale = 'ko'
) {
    const view = toTodayMarketView(data);
    if (view === null) return null;
    return renderWithIntl(<HomeTodayMarket locale={locale} view={view} />, {
        locale,
    });
}

describe('HomeTodayMarket', () => {
    it('시장별 공포탐욕 점수를 반올림해 보이고 각 허브로 링크한다', () => {
        renderSection();

        const us = screen.getByRole('link', { name: new RegExp(c.marketUs) });
        expect(us).toHaveAttribute('href', '/fear-greed');
        expect(within(us).getByText('46')).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: new RegExp(c.marketKr) })
        ).toHaveAttribute('href', '/fear-greed/kr');
        expect(
            screen.getByRole('link', { name: new RegExp(c.marketCrypto) })
        ).toHaveAttribute('href', '/fear-greed/crypto');
    });

    it('신호 종목은 종목 페이지로, 전체 보기는 시장 신호 허브로 간다', () => {
        renderSection();

        expect(screen.getByRole('link', { name: '엔비디아' })).toHaveAttribute(
            'href',
            '/NVDA'
        );
        expect(screen.getByRole('link', { name: '삼성전자' })).toHaveAttribute(
            'href',
            '/005930.KS'
        );
        expect(
            screen.getByRole('link', {
                name: c.viewAll.replace('{market}', c.signalsKr),
            })
        ).toHaveAttribute('href', '/market/kr');
        expect(screen.getByText(formatSignedPercent(2.5))).toBeInTheDocument();
    });

    it('예상 단계 신호에만 "예상" 표시를 붙인다', () => {
        renderSection();

        const krRow = screen
            .getByRole('link', { name: '삼성전자' })
            .closest('li');
        const usRow = screen
            .getByRole('link', { name: '엔비디아' })
            .closest('li');
        expect(within(krRow!).getByText(c.expectedTag)).toBeInTheDocument();
        expect(within(usRow!).queryByText(c.expectedTag)).toBeNull();
    });

    it('스캔 시각이 있으면 기준 시각을 밝히고, 없으면 그 줄을 뺀다', () => {
        renderSection();

        expect(
            screen.getByText(
                c.signalsBasis.replace(
                    '{time}',
                    formatKoreanDateTime(US_SCANNED_AT, 'ko')
                )
            )
        ).toBeInTheDocument();
        // 한국 묶음은 computedAt이 null이라 기준 줄이 하나뿐이다.
        expect(
            screen.getAllByText(
                new RegExp(c.signalsBasis.replace('{time}', '.+'))
            )
        ).toHaveLength(1);
    });

    it('기준일은 세션 날짜 그대로 찍힌다(UTC 자정으로 읽어도 KST로 하루 밀리지 않는다)', () => {
        renderSection();

        const us = screen.getByRole('link', { name: new RegExp(c.marketUs) });
        expect(
            within(us).getByText(c.asOf.replace('{date}', '2026년 11월 13일'))
        ).toBeInTheDocument();
    });

    it('점수 막대는 링크 이름에 섞이지 않게 보조기술에서 숨긴다', () => {
        renderSection();

        const us = screen.getByRole('link', { name: new RegExp(c.marketUs) });
        expect(within(us).queryByRole('progressbar')).toBeNull();
    });

    it('점수가 없는(웜업) 시장 칸은 그리지 않는다', () => {
        renderSection({
            ...FULL,
            fearGreed: {
                ...FULL.fearGreed,
                crypto: { date: '2026-11-15', score: null, label: null },
            },
        });

        expect(
            screen.queryByRole('link', { name: new RegExp(c.marketCrypto) })
        ).toBeNull();
        expect(
            screen.getByRole('link', { name: new RegExp(c.marketUs) })
        ).toBeInTheDocument();
    });

    it('신호가 없는 시장은 목록을 그리지 않는다', () => {
        renderSection({
            ...FULL,
            signals: {
                us: FULL.signals.us,
                kr: { rows: [], computedAt: US_SCANNED_AT },
            },
        });

        expect(screen.queryByRole('heading', { name: c.signalsKr })).toBeNull();
        expect(
            screen.getByRole('heading', { name: c.signalsUs })
        ).toBeInTheDocument();
    });

    it('공포탐욕도 신호도 없으면 섹션 자체를 내지 않는다', () => {
        expect(
            renderSection({
                fearGreed: { us: null, kr: null, crypto: null },
                signals: {
                    us: { rows: [], computedAt: null },
                    kr: { rows: [], computedAt: null },
                },
            })
        ).toBeNull();
    });

    it('ko가 아닌 로케일은 한글 이름 대신 티커(거래소 접미사 제거)를 쓴다', () => {
        renderSection(FULL, 'en');

        expect(
            screen.getByRole('heading', {
                name: en.app.home.todayMarket.heading,
            })
        ).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'NVDA' })).toHaveAttribute(
            'href',
            '/en/NVDA'
        );
        expect(
            screen.getByRole('link', { name: '005930' })
        ).toBeInTheDocument();
        expect(screen.queryByText('삼성전자')).toBeNull();
    });
});
