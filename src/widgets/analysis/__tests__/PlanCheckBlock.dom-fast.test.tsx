import { render, screen } from '@testing-library/react';
import type { PlanCheck } from '@y0ngha/siglens-core';
import { PlanCheckBlock } from '@/widgets/analysis/PlanCheckBlock';

function planCheck(over: Partial<PlanCheck> = {}): PlanCheck {
    return {
        currentPrice: 100,
        entryZoneTop: 100,
        exceedsEntryZone: false,
        belowStopLoss: false,
        riskRewardAtEntry: 2,
        riskRewardAtCurrent: 2,
        ...over,
    };
}

describe('PlanCheckBlock', () => {
    it('renders nothing without a plan check', () => {
        const { container } = render(<PlanCheckBlock planCheck={undefined} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('stays silent when there is nothing to say', () => {
        // 경고도 없고 잴 수 있는 비율도 없으면 헤더만 남은 빈 상자가 된다.
        const { container } = render(
            <PlanCheckBlock
                planCheck={planCheck({
                    riskRewardAtEntry: null,
                    riskRewardAtCurrent: null,
                })}
            />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('shows both ratios so a drifted plan is visible at a glance', () => {
        render(
            <PlanCheckBlock
                planCheck={planCheck({
                    riskRewardAtEntry: 2.75,
                    riskRewardAtCurrent: 0.5,
                })}
            />
        );
        expect(screen.getByText(/계획 진입가 기준 2\.75/)).toBeInTheDocument();
        expect(screen.getByText(/현재가 기준 0\.50/)).toBeInTheDocument();
    });

    it('warns when the current-price ratio is below 1', () => {
        render(
            <PlanCheckBlock
                planCheck={planCheck({ riskRewardAtCurrent: 0.42 })}
            />
        );
        expect(
            screen.getByText(/현재가 기준 손익비가 0\.42예요/)
        ).toBeInTheDocument();
    });

    it('treats a zero ratio as "no upside left", not as a small ratio', () => {
        // 0과 null은 다른 답이다. 0은 "목표가 남지 않았다"는 사실이고 null은 "잴 수 없다".
        render(
            <PlanCheckBlock planCheck={planCheck({ riskRewardAtCurrent: 0 })} />
        );
        expect(screen.getByText(/남은 목표가가 없어요/)).toBeInTheDocument();
        expect(
            screen.queryByText(/손익비가 0\.00예요/)
        ).not.toBeInTheDocument();
    });

    it('says nothing about the ratio when it cannot be measured', () => {
        render(
            <PlanCheckBlock
                planCheck={planCheck({ riskRewardAtCurrent: null })}
            />
        );
        expect(
            screen.queryByText(/남은 목표가가 없어요/)
        ).not.toBeInTheDocument();
        expect(screen.getByText(/현재가 기준 계산 불가/)).toBeInTheDocument();
    });

    it('reports how far price has run past the entry zone', () => {
        render(
            <PlanCheckBlock
                planCheck={planCheck({
                    currentPrice: 103.2,
                    entryZoneTop: 100,
                    exceedsEntryZone: true,
                })}
            />
        );
        expect(
            screen.getByText(/권장 진입 구간보다 3\.2% 높아요/)
        ).toBeInTheDocument();
    });

    it('stays quiet about the zone when there is no zone top to measure against', () => {
        // 두 필드는 타입상 독립이라 캐시된 옛 페이로드가 이 조합을 들고 올 수 있다.
        // 가드가 빠지면 화면에 `NaN%`가 찍힌다.
        render(
            <PlanCheckBlock
                planCheck={planCheck({
                    exceedsEntryZone: true,
                    entryZoneTop: null,
                })}
            />
        );
        expect(
            screen.queryByText(/권장 진입 구간보다/)
        ).not.toBeInTheDocument();
        expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    });

    it('stays quiet about the zone when the zone top is not a usable price', () => {
        // 0으로 나누면 `Infinity%`가 그대로 렌더된다.
        for (const entryZoneTop of [0, -5]) {
            const { unmount } = render(
                <PlanCheckBlock
                    planCheck={planCheck({
                        exceedsEntryZone: true,
                        entryZoneTop,
                    })}
                />
            );
            expect(
                screen.queryByText(/권장 진입 구간보다/),
                `entryZoneTop=${entryZoneTop}`
            ).not.toBeInTheDocument();
            expect(screen.queryByText(/Infinity/)).not.toBeInTheDocument();
            unmount();
        }
    });

    it('treats a risk:reward of exactly 1 as no warning', () => {
        // `< 1`과 `<= 1`의 차이. 손익분기 지점 자체는 경고 대상이 아니다.
        render(
            <PlanCheckBlock planCheck={planCheck({ riskRewardAtCurrent: 1 })} />
        );
        expect(screen.queryByText(/감수하는 손실이/)).not.toBeInTheDocument();
        expect(screen.getByText(/현재가 기준 1\.00/)).toBeInTheDocument();
    });

    it('calls a stopped-out plan void', () => {
        render(
            <PlanCheckBlock planCheck={planCheck({ belowStopLoss: true })} />
        );
        expect(screen.getByText(/이미 무효예요/)).toBeInTheDocument();
    });

    it('shows every applicable notice, not just the most severe one', () => {
        render(
            <PlanCheckBlock
                planCheck={planCheck({
                    currentPrice: 105,
                    entryZoneTop: 100,
                    exceedsEntryZone: true,
                    riskRewardAtCurrent: 0,
                })}
            />
        );
        expect(screen.getByText(/남은 목표가가 없어요/)).toBeInTheDocument();
        expect(
            screen.getByText(/권장 진입 구간보다 5\.0% 높아요/)
        ).toBeInTheDocument();
    });
});
