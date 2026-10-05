vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) =>
        args
            .flat()
            .filter(a => typeof a === 'string' && a.length > 0)
            .join(' '),
}));
vi.mock('@/shared/lib/priceFormat', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/priceFormat')>()),
    formatUsdCurrency: (n: number) => `$${n.toFixed(2)}`,
}));

import { render, screen } from '@testing-library/react';
import type { BacktestCase } from '@y0ngha/siglens-core';

import { BacktestCaseCard } from '../BacktestCaseCard';

function makeCase(overrides: Partial<BacktestCase> = {}): BacktestCase {
    return {
        ticker: 'AAPL',
        entryDate: '2024-06-15',
        exitDate: '2024-07-01',
        entryPrice: 190,
        exitPrice: 200,
        returnPct: 5.26,
        holdingDays: 16,
        result: 'win',
        signalType: 'buy',
        exitReason: 'take_profit',
        aiResult: 'win',
        aiTrendHit: true,
        aiAnalysis: {
            summary: 'AI 분석 요약',
            tags: ['골든크로스', 'RSI 과매도'],
            entryRecommendation: 'enter',
            riskLevel: 'low',
            bullishTargets: [{ price: 210, basis: '이전 고점 돌파' }],
            stopLoss: 185,
            takeProfit: 210,
        },
        ...overrides,
    };
}

describe('BacktestCaseCard', () => {
    it('renders the ticker badge', () => {
        render(<BacktestCaseCard case_={makeCase()} />);

        expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    it('renders the return percentage', () => {
        render(<BacktestCaseCard case_={makeCase()} />);

        expect(screen.getByText('+5.3%')).toBeInTheDocument();
    });

    it('renders the AI analysis summary', () => {
        render(<BacktestCaseCard case_={makeCase()} />);

        expect(screen.getByText('AI 분석 요약')).toBeInTheDocument();
    });

    it('renders tags', () => {
        render(<BacktestCaseCard case_={makeCase()} />);

        expect(screen.getByText('골든크로스')).toBeInTheDocument();
        expect(screen.getByText('RSI 과매도')).toBeInTheDocument();
    });

    it('renders entry recommendation badge', () => {
        render(<BacktestCaseCard case_={makeCase()} />);

        expect(screen.getByText('AI 진입 권고')).toBeInTheDocument();
    });

    it('renders risk badge', () => {
        render(<BacktestCaseCard case_={makeCase()} />);

        expect(screen.getByText('위험 낮음')).toBeInTheDocument();
    });

    it('renders formatted prices', () => {
        render(<BacktestCaseCard case_={makeCase()} />);

        expect(screen.getByText('$190.00')).toBeInTheDocument();
        expect(screen.getByText('$200.00')).toBeInTheDocument();
    });

    it('renders loss variant for negative returns', () => {
        render(
            <BacktestCaseCard
                case_={makeCase({
                    result: 'loss',
                    returnPct: -3.2,
                    exitReason: 'stop_loss',
                })}
            />
        );

        expect(screen.getByText('-3.2%')).toBeInTheDocument();
    });

    it('has an accessible article label', () => {
        render(<BacktestCaseCard case_={makeCase()} />);

        expect(
            screen.getByRole('article', { name: /AAPL 2024-06-15 수익/ })
        ).toBeInTheDocument();
    });
});

/**
 * 청산 칩이 결과와 무관하게 항상 danger 배색이면, 수익 케이스가
 * "초록 진입 → 빨강 청산"으로 읽힌다. 이 페이지의 논지가 승률(70%)인데
 * 배색이 그 반대를 말하는 셈이다. 손절만 빨강이어야 한다.
 */
describe('청산 칩 배색', () => {
    it('손절은 danger 배색이다', () => {
        const { container } = render(
            <BacktestCaseCard case_={makeCase({ exitReason: 'stop_loss' })} />
        );
        const chip = screen.getByText('손절').parentElement as HTMLElement;
        expect(chip.className).toContain('chart-bearish');
        expect(container).toBeTruthy();
    });

    it.each(['take_profit', 'time'] as const)(
        '%s 청산은 danger 배색이 아니다',
        reason => {
            render(
                <BacktestCaseCard
                    case_={makeCase({ exitReason: reason, result: 'win' })}
                />
            );
            const chip = screen.getByText('매도').parentElement as HTMLElement;
            expect(chip.className).not.toContain('chart-bearish');
        }
    );
});

/**
 * 10개 종목을 다루면서 심볼 페이지로 나가는 내부 링크가 하나도 없었다
 * (감사 실측: 앵커 43개가 전부 전역 nav/footer 크롬). 배지를 링크로 되돌려
 * 놓아도 화면상 차이가 거의 없어 조용히 회귀한다.
 */
describe('티커 링크', () => {
    it('티커 배지가 종목 페이지로 간다', () => {
        render(<BacktestCaseCard case_={makeCase({ ticker: 'GOOGL' })} />);
        expect(screen.getByText('GOOGL')).toHaveAttribute('href', '/GOOGL');
    });
});

/**
 * 위험도 배지는 원문 enum 대문자(`HIGH`)를 그대로 찍지 않고 라벨로 푼다. 공개 데이터에는
 * core 타입에 없는 `medium`이 실제로 들어 있다(72건) — `moderate`만 매핑하면 가장 흔한
 * 값이 새므로 둘 다 "보통"이어야 한다.
 */
describe('위험도 배지 라벨', () => {
    const withRisk = (riskLevel: string) => {
        const base = makeCase();
        return makeCase({
            aiAnalysis: {
                ...base.aiAnalysis,
                // 데이터에는 타입에 없는 값이 있다 — JSON 파서처럼 any로 만든다.
                riskLevel: JSON.parse(JSON.stringify(riskLevel)),
            },
        });
    };

    it.each([
        ['low', '위험 낮음'],
        ['medium', '위험 보통'],
        ['moderate', '위험 보통'],
        ['high', '위험 높음'],
        ['extreme', '위험 매우 높음'],
    ])('%s → %s', (level, label) => {
        const { container } = render(
            <BacktestCaseCard case_={withRisk(level)} />
        );
        expect(screen.getByText(label)).toBeInTheDocument();
        expect(container.textContent).not.toContain(level.toUpperCase());
        expect(container.textContent).not.toMatch(new RegExp(`\\b${level}\\b`));
    });

    it('알 수 없는 값은 배지를 그리지 않는다', () => {
        const { container } = render(
            <BacktestCaseCard case_={withRisk('mystery')} />
        );
        expect(container.textContent).not.toMatch(/mystery|MYSTERY|위험/);
    });
});

describe('라벨 한글화', () => {
    it('TP/SL 대신 익절가·손절가로 표기한다', () => {
        const { container } = render(<BacktestCaseCard case_={makeCase()} />);
        expect(screen.getByText(/익절가:/)).toBeInTheDocument();
        expect(screen.getByText(/손절가:/)).toBeInTheDocument();
        expect(container.textContent).not.toMatch(/\bTP:|\bSL:/);
    });

    it('관망 권고 배지는 "AI 관망 권고"다', () => {
        const base = makeCase();
        render(
            <BacktestCaseCard
                case_={makeCase({
                    aiAnalysis: {
                        ...base.aiAnalysis,
                        entryRecommendation: 'wait',
                    },
                })}
            />
        );
        expect(screen.getByText('AI 관망 권고')).toBeInTheDocument();
    });
});

/**
 * 9~11px 글자는 읽기 어렵고, 근거(`basis`)를 `line-clamp-1`로 자르면 AI가 쓴 근거가
 * 통째로 보이지 않는다. 모두 12px(`text-xs`)로 올리고 말줄임을 걷었다.
 */
describe('가독성', () => {
    it('9/10/11px 임의 글자 크기를 쓰지 않는다', () => {
        const { container } = render(<BacktestCaseCard case_={makeCase()} />);
        expect(container.innerHTML).not.toMatch(/text-\[(9|10|11)px\]/);
    });

    it('요약과 근거를 잘라 내지 않는다 (line-clamp 없음, 전문 노출)', () => {
        const base = makeCase();
        const longBasis =
            '이전 고점 돌파 후 거래량 동반 안착이 확인되어야 한다는 긴 근거 문장';
        const longSummary = '요약 '.repeat(80).trim();
        const { container } = render(
            <BacktestCaseCard
                case_={makeCase({
                    aiAnalysis: {
                        ...base.aiAnalysis,
                        summary: longSummary,
                        bullishTargets: [{ price: 210, basis: longBasis }],
                    },
                })}
            />
        );
        expect(container.innerHTML).not.toContain('line-clamp');
        expect(screen.getByText(longSummary)).toBeInTheDocument();
        expect(screen.getByText(new RegExp(longBasis))).toBeInTheDocument();
    });
});
