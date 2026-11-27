import { render, screen } from '@testing-library/react';
import { BacktestTimingCheck } from '../../BacktestTimingCheck';
import { BENCHMARKS, makeStats } from '../fixtures/statsFixture';

const withCi = (low: number, high: number) =>
    makeStats({
        benchmarks: {
            ...BENCHMARKS,
            perTradeExcess: {
                ...BENCHMARKS.perTradeExcess,
                ci95: { low, high },
            },
        },
    });

const VERDICT_HIGHER =
    'AI 매매의 수익률이 같은 날수만큼 보유했을 때보다 높았어요';
const VERDICT_LOWER =
    'AI 매매의 수익률이 같은 날수만큼 보유했을 때보다 낮았어요';
const VERDICT_NONE =
    'AI 매매의 수익률과 같은 날수만큼 보유했을 때 사이에 뚜렷한 차이가 없었어요';

describe('BacktestTimingCheck', () => {
    it('renders a headed section', () => {
        render(<BacktestTimingCheck stats={makeStats()} />);
        expect(
            screen.getByRole('heading', { level: 2, name: '진입 시점의 효과' })
        ).toBeInTheDocument();
    });

    it('states the per-trade difference with its 95% range and trade count', () => {
        render(<BacktestTimingCheck stats={makeStats()} />);
        expect(
            screen.getByText(
                '매매마다 같은 종목을 기간 중 아무 날에나 사서 같은 날수만큼 들고 있었을 때의 평균 수익률과 비교하면, 거래당 평균 차이는 -0.06%였어요 (95% 범위 -0.40%~+0.30%, 690건).'
            )
        ).toBeInTheDocument();
    });

    it('reports the random-entry return share with the draw count and the middle 90%', () => {
        render(<BacktestTimingCheck stats={makeStats()} />);
        expect(
            screen.getByText(
                '같은 보유 기간들을 임의의 날짜에 넣어 2,000번 돌려 보면 포트폴리오 수익률은 가운데 90%가 +12.7%~+49.9%였고, AI 전략보다 높았던 경우는 50.9%였어요.'
            )
        ).toBeInTheDocument();
    });

    it('reports the smaller-drawdown share against the mark-to-market drawdown and names the stop rule', () => {
        render(<BacktestTimingCheck stats={makeStats()} />);
        expect(
            screen.getByText(
                '같은 시험에서 최대 낙폭이 AI 전략(-12.4%)보다 작았던 경우는 0.6%였어요. 임의 날짜 시험에는 손절가에서 바로 정리하는 규칙이 없어서, 이 차이에는 그 규칙의 영향이 섞여 있어요.'
            )
        ).toBeInTheDocument();
    });

    it('repeats the past-results disclaimer of the hero', () => {
        render(<BacktestTimingCheck stats={makeStats()} />);
        expect(
            screen.getByText(
                '과거 데이터 기준이라 앞으로의 성과를 보장하지는 않아요.'
            )
        ).toBeInTheDocument();
    });

    it('says higher only when the whole range is above 0', () => {
        render(<BacktestTimingCheck stats={withCi(0.05, 0.41)} />);
        expect(
            screen.getByText(new RegExp(VERDICT_HIGHER))
        ).toBeInTheDocument();
        expect(screen.queryByText(new RegExp(VERDICT_LOWER))).toBeNull();
        expect(screen.queryByText(new RegExp(VERDICT_NONE))).toBeNull();
    });

    it('says lower only when the whole range is below 0', () => {
        render(<BacktestTimingCheck stats={withCi(-0.52, -0.07)} />);
        expect(screen.getByText(new RegExp(VERDICT_LOWER))).toBeInTheDocument();
        expect(screen.queryByText(new RegExp(VERDICT_HIGHER))).toBeNull();
        expect(screen.queryByText(new RegExp(VERDICT_NONE))).toBeNull();
    });

    it('says there is no clear difference when the range straddles 0', () => {
        render(<BacktestTimingCheck stats={withCi(-0.4009, 0.3021)} />);
        expect(screen.getByText(new RegExp(VERDICT_NONE))).toBeInTheDocument();
        expect(screen.queryByText(new RegExp(VERDICT_HIGHER))).toBeNull();
        expect(screen.queryByText(new RegExp(VERDICT_LOWER))).toBeNull();
    });
});
