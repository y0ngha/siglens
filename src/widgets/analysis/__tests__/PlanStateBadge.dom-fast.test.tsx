import { render, screen } from '@testing-library/react';
import type { PlanState } from '@y0ngha/siglens-core';
import { PlanStateBadge } from '@/widgets/analysis/ui/PlanStateBadge';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';

const BASE = { atr: 2, stopDistanceAtr: 1.1, stopBasis: 'model' } as const;

function placed(position: 'in_zone' | 'above_zone' | 'below_zone'): PlanState {
    return { ...BASE, position, distanceAtr: 0.5 };
}

describe('PlanStateBadge', () => {
    it('renders nothing without a plan state (old cached results)', () => {
        const { container } = render(<PlanStateBadge planState={undefined} />);
        expect(container).toBeEmptyDOMElement();
    });

    it.each([
        ['in_zone', '진입 구간 안'],
        ['above_zone', '진입 구간보다 위'],
        ['below_zone', '진입 구간보다 아래'],
    ] as const)('writes the %s position as a fact', (position, label) => {
        render(<PlanStateBadge planState={placed(position)} />);
        expect(screen.getByText('계획 상태')).toBeInTheDocument();
        expect(screen.getByText(label)).toBeInTheDocument();
    });

    it.each([
        [0, '진입 구간 바로 위'],
        [0.2, '진입 구간 바로 위'],
        [0.49, '진입 구간 바로 위'],
        [0.5, '진입 구간보다 위'],
        [1.8, '진입 구간보다 위'],
    ])(
        'words an above_zone close %s ATR over the zone top as "%s"',
        (distanceAtr, label) => {
            render(
                <PlanStateBadge
                    planState={{ ...BASE, position: 'above_zone', distanceAtr }}
                />
            );
            expect(screen.getByText(label)).toBeInTheDocument();
        }
    );

    it('keeps the plain above-zone wording when the distance is unknown', () => {
        render(
            <PlanStateBadge
                planState={{
                    ...BASE,
                    position: 'above_zone',
                    distanceAtr: null,
                }}
            />
        );
        expect(screen.getByText('진입 구간보다 위')).toBeInTheDocument();
    });

    it('never says "just above" for the other positions', () => {
        render(
            <PlanStateBadge
                planState={{
                    ...BASE,
                    position: 'below_zone',
                    distanceAtr: 0.1,
                }}
            />
        );
        expect(screen.queryByText('진입 구간 바로 위')).not.toBeInTheDocument();
        expect(screen.getByText('진입 구간보다 아래')).toBeInTheDocument();
    });

    it('adds no reason line for a placed plan', () => {
        const { container } = render(
            <PlanStateBadge planState={placed('in_zone')} />
        );
        expect(container.querySelectorAll('p')).toHaveLength(0);
    });

    it.each([
        ['no_zone', '진입 구간이 없어요'],
        ['no_stop', '손절 기준을 정할 수 없어요'],
        ['stopped', '현재가가 손절 기준 아래에 있어요'],
        ['no_room_above', '진입 구간 위로 여유 있는 목표가가 없어요'],
    ] as const)(
        'shows the %s reason under the no_setup badge',
        (reason, line) => {
            render(
                <PlanStateBadge
                    planState={{ ...BASE, position: 'no_setup', reason }}
                />
            );
            expect(screen.getByText('근거 있는 자리 없음')).toBeInTheDocument();
            expect(screen.getByText(line)).toBeInTheDocument();
        }
    );

    it('says the stop is range based only when its basis is atr', () => {
        const atrNote = '가격대가 아니라 변동폭(ATR) 기준 손절이에요';
        const { rerender } = render(
            <PlanStateBadge
                planState={{ ...placed('in_zone'), stopBasis: 'atr' }}
            />
        );
        expect(screen.getByText(atrNote)).toBeInTheDocument();

        rerender(
            <PlanStateBadge
                planState={{ ...placed('in_zone'), stopBasis: 'level' }}
            />
        );
        expect(screen.queryByText(atrNote)).not.toBeInTheDocument();

        rerender(
            <PlanStateBadge
                planState={{
                    ...placed('in_zone'),
                    stopBasis: null,
                    stopDistanceAtr: null,
                }}
            />
        );
        expect(screen.queryByText(atrNote)).not.toBeInTheDocument();
    });

    it('en: uses the English catalog', () => {
        renderWithIntl(<PlanStateBadge planState={placed('above_zone')} />, {
            locale: 'en',
        });
        expect(screen.getByText('Plan status')).toBeInTheDocument();
        expect(screen.getByText('Above the entry zone')).toBeInTheDocument();
    });
});
