import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SectorFactsSummary } from '@/widgets/dashboard/SectorFactsSummary';
import type {
    Signal,
    SectorSignalsResult,
    StockSignalResult,
} from '@y0ngha/siglens-core';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { TEST_SCOPE } from './helpers/testScope';

function makeSignal(
    direction: 'bullish' | 'bearish',
    phase: 'confirmed' | 'expected' = 'confirmed'
): Signal {
    return { type: 'golden_cross', direction, phase, detectedAt: 0 };
}

function makeStock(
    symbol: string,
    sectorSymbol: string,
    direction: 'bullish' | 'bearish' = 'bullish',
    overrides: Partial<StockSignalResult> = {}
): StockSignalResult {
    return {
        symbol,
        koreanName: `${symbol}-KR`,
        sectorSymbol,
        price: 100,
        changePercent: 1.5,
        trend: 'uptrend',
        signals: [makeSignal(direction)],
        ...overrides,
    };
}

function makeResult(stocks: StockSignalResult[]): SectorSignalsResult {
    return { computedAt: '2026-06-04T00:00:00Z', stocks };
}

function renderSummary(stocks: StockSignalResult[]) {
    return render(
        <SectorFactsSummary data={makeResult(stocks)} scope={TEST_SCOPE} />
    );
}

describe('SectorFactsSummary', () => {
    it('(Happy) 빈 stocks → 섹션 + 빈-신호 안내 텍스트를 렌더한다 (크롤 텍스트 보장)', () => {
        renderSummary([]);
        expect(
            screen.getByRole('region', { name: '섹터별 신호 요약' })
        ).toBeInTheDocument();
        expect(
            screen.getByText(/현재 기술적 신호가 잡힌 종목이 없습니다/)
        ).toBeInTheDocument();
    });

    it('(Happy) 섹터별 신호 요약 섹션을 렌더한다', () => {
        renderSummary([makeStock('AAPL', 'XLK', 'bullish')]);
        expect(
            screen.getByRole('region', { name: '섹터별 신호 요약' })
        ).toBeInTheDocument();
    });

    it('(Happy) h2 heading이 있다', () => {
        renderSummary([makeStock('AAPL', 'XLK', 'bullish')]);
        expect(
            screen.getByRole('heading', { name: /섹터별 신호 모아보기/ })
        ).toBeInTheDocument();
    });

    it('(Happy) 상승 신호 카운트 텍스트가 렌더된다', () => {
        renderSummary([
            makeStock('AAPL', 'XLK', 'bullish'),
            makeStock('MSFT', 'XLK', 'bullish'),
        ]);
        expect(screen.getByText(/상승 신호 2종목/)).toBeInTheDocument();
    });

    it('(Happy) 하락 신호 카운트 텍스트가 렌더된다', () => {
        renderSummary([makeStock('NVDA', 'XLK', 'bearish')]);
        expect(screen.getByText(/하락 신호 1종목/)).toBeInTheDocument();
    });

    it('(Happy) 대표 심볼이 렌더된다', () => {
        renderSummary([makeStock('AAPL', 'XLK', 'bullish')]);
        expect(screen.getByText(/AAPL/)).toBeInTheDocument();
    });

    it('(Happy) topSymbols가 /{symbol} href를 가진 크롤 가능 링크로 렌더된다', () => {
        // SEO 회귀 가드: topSymbols가 일반 텍스트로 되돌아가거나 href 포맷이 바뀌면
        // (크롤러용 서버사이드 내부 링크) 이 단언이 깨진다.
        renderSummary([makeStock('AAPL', 'XLK', 'bullish')]);
        // 앵커 텍스트는 `이름 (티커)` — 티커만 있는 앵커는 검색어와 거리가 멀다.
        expect(
            screen.getByRole('link', { name: '애플 (AAPL)' })
        ).toHaveAttribute('href', '/AAPL');
    });

    it('(Happy) 카탈로그에 없는 종목은 데이터의 koreanName으로 앵커를 만든다', () => {
        renderSummary([makeStock('ZZZQ', 'XLK', 'bullish')]);
        expect(
            screen.getByRole('link', { name: 'ZZZQ-KR (ZZZQ)' })
        ).toHaveAttribute('href', '/ZZZQ');
    });

    it('(Happy) 여러 섹터가 모두 렌더된다', () => {
        renderSummary([
            makeStock('AAPL', 'XLK', 'bullish'),
            makeStock('JPM', 'XLF', 'bullish'),
        ]);
        expect(screen.getAllByRole('term')).toHaveLength(2);
    });

    it('(Worst) 완전 빈 SectorSignalsResult → 빈-신호 안내 텍스트를 렌더한다', () => {
        render(
            <SectorFactsSummary
                data={{ computedAt: '', stocks: [] }}
                scope={TEST_SCOPE}
            />
        );
        expect(
            screen.getByText(/현재 기술적 신호가 잡힌 종목이 없습니다/)
        ).toBeInTheDocument();
    });

    it('(Worst) signals가 빈 배열인 종목만 있으면 → 빈-신호 안내 텍스트를 렌더한다', () => {
        renderSummary([makeStock('AAPL', 'XLK', 'bullish', { signals: [] })]);
        expect(
            screen.getByText(/현재 기술적 신호가 잡힌 종목이 없습니다/)
        ).toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    describe('섹터 라벨', () => {
        it.each([
            ['ko', '기술'],
            ['en', 'Technology'],
            ['ja', 'テクノロジー'],
        ] as const)(
            '%s: 섹터명을 그 로케일 라벨로 보여 준다',
            (locale, label) => {
                renderWithIntl(
                    <SectorFactsSummary
                        data={makeResult([makeStock('AAPL', 'XLK', 'bullish')])}
                        scope={TEST_SCOPE}
                    />,
                    { locale }
                );
                expect(screen.getByRole('term')).toHaveTextContent(label);
                expect(screen.getByRole('term')).not.toHaveTextContent('XLK');
            }
        );

        it('카탈로그에 라벨이 없으면 scope의 koreanName으로 폴백한다', () => {
            const scope = {
                ...TEST_SCOPE,
                signalSectors: [
                    ...TEST_SCOPE.signalSectors,
                    {
                        symbol: 'ZZZ_SECTOR',
                        sectorName: 'Unknown',
                        koreanName: '미등록섹터',
                    },
                ],
            };
            render(
                <SectorFactsSummary
                    data={makeResult([makeStock('AAPL', 'ZZZ_SECTOR')])}
                    scope={scope}
                />
            );
            expect(screen.getByRole('term')).toHaveTextContent('미등록섹터');
        });
    });

    /**
     * 요약은 패널이 실제로 보여 주는 종목만 센다. 패널은 추세와 어긋난 예상 신호를 걷어내고
     * 상충 신호를 정리한 뒤에 그린다 — 원본으로 세면 패널에 없는 종목을 세고 링크한다.
     */
    describe('패널과 같은 종목 집합', () => {
        it('상승 추세 종목의 상승 예상 신호만 있으면 그 종목을 세지도 링크하지도 않는다', () => {
            renderSummary([
                makeStock('AAPL', 'XLK', 'bullish', {
                    trend: 'uptrend',
                    signals: [makeSignal('bullish', 'expected')],
                }),
            ]);
            expect(screen.queryByRole('link')).not.toBeInTheDocument();
            expect(
                screen.getByText(/현재 기술적 신호가 잡힌 종목이 없습니다/)
            ).toBeInTheDocument();
        });

        it('추세와 어긋난 예상 신호는 그대로 센다', () => {
            renderSummary([
                makeStock('AAPL', 'XLK', 'bullish', {
                    trend: 'downtrend',
                    signals: [makeSignal('bullish', 'expected')],
                }),
            ]);
            expect(screen.getByText(/상승 신호 1종목/)).toBeInTheDocument();
        });

        it('상충 신호는 우세한 방향만 센다', () => {
            renderSummary([
                makeStock('AAPL', 'XLK', 'bullish', {
                    signals: [
                        makeSignal('bullish'),
                        makeSignal('bullish'),
                        makeSignal('bearish'),
                    ],
                }),
            ]);
            expect(
                screen.getByText(/상승 신호 1종목, 하락 신호 0종목/)
            ).toBeInTheDocument();
        });

        it('방향이 팽팽한 혼재 종목은 양쪽에 센다', () => {
            renderSummary([
                makeStock('AAPL', 'XLK', 'bullish', {
                    signals: [makeSignal('bullish'), makeSignal('bearish')],
                }),
            ]);
            expect(
                screen.getByText(/상승 신호 1종목, 하락 신호 1종목/)
            ).toBeInTheDocument();
        });
    });
});
