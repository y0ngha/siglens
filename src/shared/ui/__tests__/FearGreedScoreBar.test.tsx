import { render, screen } from '@testing-library/react';
import { FearGreedScoreBar } from '@/shared/ui/FearGreedScoreBar';

describe('FearGreedScoreBar', () => {
    it('exposes the value through an accessible progressbar', () => {
        render(<FearGreedScoreBar value={42} label="모멘텀 백분위 42" />);
        const bar = screen.getByRole('progressbar', {
            name: '모멘텀 백분위 42',
        });
        expect(bar).toHaveAttribute('aria-valuenow', '42');
        expect(bar).toHaveAttribute('aria-valuemin', '0');
        expect(bar).toHaveAttribute('aria-valuemax', '100');
    });

    it('sets the fill width from the value', () => {
        const { container } = render(
            <FearGreedScoreBar value={37} label="x" />
        );
        const fill = container.querySelector<HTMLElement>(
            '[role="progressbar"] > div'
        );
        expect(fill?.style.getPropertyValue('--bar-width')).toBe('37%');
    });

    describe('score-color fill', () => {
        // 밴드마다 정확히 하나의 클래스만 나와야 한다. `toContain`으로 문자열
        // 부분매치를 하면 `bg-ui-success`가 `bg-ui-success/85`의 부분 문자열이라
        // GREED/EXTREME_GREED 매핑이 한 칸씩 밀려도(예: BAR_FILL_COLOR가 통째로
        // 한 밴드씩 시프트) 계속 통과한다. 공백으로 토큰을 나눠 정확히 일치하는
        // 클래스만 확인하고, 나머지 4개 밴드 클래스는 없는지도 함께 못박는다.
        const ALL_BAND_CLASSES = [
            'bg-ui-danger',
            'bg-ui-warning',
            'bg-secondary-400',
            'bg-ui-success/85',
            'bg-ui-success',
        ] as const;

        it.each([
            ['EXTREME_FEAR', 10, 'bg-ui-danger'],
            ['FEAR', 30, 'bg-ui-warning'],
            ['NEUTRAL', 50, 'bg-secondary-400'],
            ['GREED', 65, 'bg-ui-success/85'],
            ['EXTREME_GREED', 85, 'bg-ui-success'],
        ] as const)(
            '%s(value=%d) → 정확히 %s 클래스만 렌더된다',
            (_bandName, value, expectedClass) => {
                const { container } = render(
                    <FearGreedScoreBar value={value} label="x" />
                );
                const fill = container.querySelector(
                    '[role="progressbar"] > div'
                );
                const classes = fill?.className.split(' ') ?? [];

                expect(classes).toContain(expectedClass);
                ALL_BAND_CLASSES.filter(cls => cls !== expectedClass).forEach(
                    otherClass => {
                        expect(classes).not.toContain(otherClass);
                    }
                );
            }
        );
    });
});
