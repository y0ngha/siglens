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
    locale: Locale = 'ko'
) {
    const tree = await resolveAsyncServerTree(
        <GuideLiveSymbols locale={locale} groups={groups} />
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
                    },
                    {
                        symbol: 'TSLA',
                        name: null,
                        changePercent: null,
                        basis: 'snapshot',
                        detectedOn: '2026-10-24T21:00:00.000Z',
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
            screen.getByRole('link', { name: '엔비디아(NVDA) 차트 보기' })
        ).toHaveAttribute('href', '/NVDA');
        const down = screen.getByText('-2.3%');
        expect(down).toHaveClass('text-ui-danger-text');
        expect(screen.getByText('+0.5%')).toHaveClass('text-ui-success-text');
        // 이름을 모르는 스냅샷 행은 심볼로 대신한다
        expect(
            screen.getByRole('link', { name: 'TSLA 차트 보기' })
        ).toHaveAttribute('href', '/TSLA');
        expect(screen.getByText(/탐지$/)).toBeInTheDocument();
        // 기준 시각 두 줄(스캐너·스냅샷)
        expect(screen.getByText(/신호 스캐너 ·/)).toBeInTheDocument();
        expect(screen.getByText(/장 마감 스냅샷 ·/)).toBeInTheDocument();
    });

    it('한국 종목은 접미사를 뗀 코드로 표기하고 링크는 심볼 그대로 둔다', async () => {
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
                    },
                    {
                        symbol: '247540.KQ',
                        name: null,
                        changePercent: null,
                        basis: 'snapshot',
                        detectedOn: '2026-10-24T21:00:00.000Z',
                    },
                ],
            },
        ]);

        expect(
            screen.getByRole('link', { name: '삼성전자(005930) 차트 보기' })
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
                    },
                    {
                        symbol: 'BBB',
                        name: 'B',
                        changePercent: 1,
                        basis: 'scanner',
                        detectedOn: '2026-10-25T20:00:00.000Z',
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
                            },
                        ],
                    },
                ],
                locale
            );

            const link = screen.getByRole('link', { name: /AAPL/ });
            expect(link).toHaveAttribute('href', `/${locale}/AAPL`);
            expect(link).not.toHaveTextContent('애플');
        }
    );

    it('그룹이 비면 아무것도 그리지 않는다', async () => {
        const { container } = await renderLive([]);

        expect(container).toBeEmptyDOMElement();
    });
});
