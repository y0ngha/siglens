import { screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { resolveAsyncServerTree } from '@/shared/test-utils/resolveAsyncServerTree';
import type { Locale } from '@/shared/i18n/locales';
import ko from '../../../../../messages/ko.json';
import { GuideLiveSymbols } from '../GuideLiveSymbols';

const g = ko.views.guide;

async function renderLive(
    groups: Parameters<typeof GuideLiveSymbols>[0]['groups'],
    locale: Locale = 'ko',
    patternTitles: Record<string, string> = {}
) {
    const tree = await resolveAsyncServerTree(
        <GuideLiveSymbols
            locale={locale}
            groups={groups}
            patternTitles={patternTitles}
        />
    );
    return renderWithIntl(tree as ReactElement, { locale });
}

describe('GuideLiveSymbols', () => {
    it('시장별 그룹과 종목 링크, 기준 시각을 그린다', async () => {
        await renderLive([
            {
                market: 'us',
                rows: [
                    {
                        symbol: 'NVDA',
                        name: '엔비디아',
                        changePercent: -2.345,
                        basis: 'scanner',
                        detectedOn: '2026-10-25T00:00:00.000Z',
                        match: null,
                    },
                    {
                        symbol: 'TSLA',
                        name: null,
                        changePercent: null,
                        basis: 'snapshot',
                        detectedOn: '2026-10-24T21:00:00.000Z',
                        match: null,
                    },
                ],
            },
            {
                market: 'kr',
                rows: [
                    {
                        symbol: '005930.KS',
                        name: '삼성전자',
                        changePercent: 0.5,
                        basis: 'scanner',
                        detectedOn: '2026-10-25T00:00:00.000Z',
                        match: null,
                    },
                ],
            },
        ]);

        expect(
            screen.getByRole('heading', { level: 2, name: g.liveHeading })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { level: 3, name: g.liveMarketUs })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { level: 3, name: g.liveMarketKr })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: '엔비디아 차트 보기' })
        ).toHaveAttribute('href', '/NVDA');
        const down = screen.getByText('-2.3%');
        expect(down).toHaveClass('text-ui-danger-text');
        expect(screen.getByText('+0.5%')).toHaveClass('text-ui-success-text');
        // 이름을 모르는 스냅샷 행은 코드로 대신한다
        expect(
            screen.getByRole('link', { name: 'TSLA 차트 보기' })
        ).toHaveAttribute('href', '/TSLA');
        expect(screen.getByText(/탐지$/)).toBeInTheDocument();
        // 기준 시각 두 줄(스캐너·스냅샷)
        expect(screen.getByText(/신호 스캐너 ·/)).toBeInTheDocument();
        expect(screen.getByText(/장 마감 스냅샷 ·/)).toBeInTheDocument();
    });

    it('ko는 코드를 병기하지 않고 한국어 이름만 적는다', async () => {
        await renderLive([
            {
                market: 'us',
                rows: [
                    {
                        symbol: 'AAPL',
                        name: '애플',
                        changePercent: 1,
                        basis: 'scanner',
                        detectedOn: '2026-10-25T00:00:00.000Z',
                        match: null,
                    },
                ],
            },
        ]);

        const link = screen.getByRole('link', { name: '애플 차트 보기' });
        expect(link).toHaveAttribute('href', '/AAPL');
        expect(link).not.toHaveTextContent('AAPL');
    });

    it('한국 종목은 이름만 적고 이름이 없으면 접미사를 뗀 코드로 대신하며 링크는 심볼 그대로 둔다', async () => {
        await renderLive([
            {
                market: 'kr',
                rows: [
                    {
                        symbol: '005930.KS',
                        name: '삼성전자',
                        changePercent: 0.5,
                        basis: 'scanner',
                        detectedOn: '2026-10-25T00:00:00.000Z',
                        match: null,
                    },
                    {
                        symbol: '247540.KQ',
                        name: null,
                        changePercent: null,
                        basis: 'snapshot',
                        detectedOn: '2026-10-24T21:00:00.000Z',
                        match: null,
                    },
                ],
            },
        ]);

        expect(
            screen.getByRole('link', { name: '삼성전자 차트 보기' })
        ).toHaveAttribute('href', '/005930.KS');
        expect(
            screen.getByRole('link', { name: '247540 차트 보기' })
        ).toHaveAttribute('href', '/247540.KQ');
    });

    it('기준 시각은 오프셋 표기가 섞여도 가장 늦은 시각을 고른다', async () => {
        // 사전순으로는 '...T23:00:00+09:00'가 더 크지만 실제로는 14:00Z로 더 이르다.
        await renderLive([
            {
                market: 'us',
                rows: [
                    {
                        symbol: 'AAA',
                        name: 'A',
                        changePercent: 1,
                        basis: 'scanner',
                        detectedOn: '2026-10-25T23:00:00+09:00',
                        match: null,
                    },
                    {
                        symbol: 'BBB',
                        name: 'B',
                        changePercent: 1,
                        basis: 'scanner',
                        detectedOn: '2026-10-25T20:00:00.000Z',
                        match: null,
                    },
                ],
            },
        ]);

        // 20:00Z = 26일 05시 00분 KST(정답), 14:00Z = 25일 23시 00분 KST(사전순 오답)
        expect(screen.getByText(/신호 스캐너 ·/)).toHaveTextContent(
            '26일 05시 00분'
        );
    });

    it.each(['en', 'ja', 'zh'] as const)(
        '%s 로케일은 한국어 이름을 쓰지 않고 심볼만 적는다',
        async locale => {
            await renderLive(
                [
                    {
                        market: 'us',
                        rows: [
                            {
                                symbol: 'AAPL',
                                name: '애플',
                                changePercent: 1,
                                basis: 'scanner',
                                detectedOn: '2026-10-25T00:00:00.000Z',
                                match: null,
                            },
                        ],
                    },
                ],
                locale
            );

            const link = screen.getByRole('link', { name: /AAPL/ });
            expect(link).toHaveAttribute('href', `/${locale}/AAPL`);
            expect(link.textContent).not.toMatch(/[가-힣]/);
            expect(link).not.toHaveTextContent('애플');
        }
    );

    it('스캐너 행은 맞은 신호 라벨을, 예상 신호는 "(예상)"을 덧붙여 적는다', async () => {
        await renderLive([
            {
                market: 'us',
                rows: [
                    {
                        symbol: 'NVDA',
                        name: '엔비디아',
                        changePercent: 1,
                        basis: 'scanner',
                        detectedOn: '2026-10-25T00:00:00.000Z',
                        match: {
                            kind: 'signal',
                            signalType: 'rsi_oversold',
                            expected: false,
                        },
                    },
                    {
                        symbol: 'AAPL',
                        name: '애플',
                        changePercent: 2,
                        basis: 'scanner',
                        detectedOn: '2026-10-25T00:00:00.000Z',
                        match: {
                            kind: 'signal',
                            signalType: 'rsi_bullish_divergence',
                            expected: true,
                        },
                    },
                ],
            },
        ]);

        const confirmed = screen.getByText(
            ko.shared.enumLabel.signalType.rsi_oversold
        );
        expect(confirmed.parentElement).not.toHaveTextContent(
            g.liveExpectedTag
        );
        const expected = screen.getByText(
            ko.shared.enumLabel.signalType.rsi_bullish_divergence
        );
        expect(expected.parentElement).toHaveTextContent(
            `${ko.shared.enumLabel.signalType.rsi_bullish_divergence}${g.liveExpectedTag}`
        );
        expect(g.liveExpectedTag).toBe('(예상)');
    });

    it('스냅샷 행은 맞은 패턴의 가이드 제목을 적고, 제목을 모르면 아무것도 적지 않는다', async () => {
        await renderLive(
            [
                {
                    market: 'us',
                    rows: [
                        {
                            symbol: 'TSLA',
                            name: null,
                            changePercent: null,
                            basis: 'snapshot',
                            detectedOn: '2026-10-24T21:00:00.000Z',
                            match: {
                                kind: 'pattern',
                                guidePath:
                                    '/guide/chart-patterns/double-bottom',
                            },
                        },
                        {
                            symbol: 'AMD',
                            name: null,
                            changePercent: null,
                            basis: 'snapshot',
                            detectedOn: '2026-10-24T21:00:00.000Z',
                            match: {
                                kind: 'pattern',
                                guidePath: '/guide/chart-patterns/unknown',
                            },
                        },
                    ],
                },
            ],
            'ko',
            { '/guide/chart-patterns/double-bottom': '이중바닥' }
        );

        expect(screen.getByText('이중바닥')).toBeInTheDocument();
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
        expect(screen.getAllByRole('listitem')[1]).toHaveTextContent(
            /^AMD 차트 보기/
        );
    });

    it('그룹이 비면 아무것도 그리지 않는다', async () => {
        const { container } = await renderLive([]);

        expect(container).toBeEmptyDOMElement();
    });
});
