import { render, screen, fireEvent } from '@testing-library/react';
import { ReasoningToggle } from '@/features/reasoning-toggle/ui/ReasoningToggle';

describe('ReasoningToggle', () => {
    it('renders nothing when visible is false (anonymous/free)', () => {
        const { container } = render(
            <ReasoningToggle
                checked={false}
                onChange={vi.fn()}
                visible={false}
            />
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders the switch when visible is true (member/pro)', () => {
        render(
            <ReasoningToggle
                checked={false}
                onChange={vi.fn()}
                visible={true}
            />
        );
        expect(screen.getByRole('switch')).toBeDefined();
        expect(screen.getByText('깊은 생각')).toBeDefined();
    });

    it('reflects checked=true via aria-checked', () => {
        render(
            <ReasoningToggle checked={true} onChange={vi.fn()} visible={true} />
        );
        expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe(
            'true'
        );
    });

    it('reflects checked=false via aria-checked', () => {
        render(
            <ReasoningToggle
                checked={false}
                onChange={vi.fn()}
                visible={true}
            />
        );
        expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe(
            'false'
        );
    });

    it('calls onChange with the toggled value on click', () => {
        const onChange = vi.fn();
        render(
            <ReasoningToggle
                checked={false}
                onChange={onChange}
                visible={true}
            />
        );

        fireEvent.click(screen.getByRole('switch'));

        expect(onChange).toHaveBeenCalledWith(true);
    });

    it('shows the delay-notice text when checked', () => {
        render(
            <ReasoningToggle checked={true} onChange={vi.fn()} visible={true} />
        );
        expect(
            screen.getByText(
                '추론을 켜면 상세 분석을 하느라 응답이 다소 지연될 수 있어요.'
            )
        ).toBeDefined();
    });

    it('hides the delay-notice text when unchecked', () => {
        render(
            <ReasoningToggle
                checked={false}
                onChange={vi.fn()}
                visible={true}
            />
        );
        expect(
            screen.queryByText(
                '추론을 켜면 상세 분석을 하느라 응답이 다소 지연될 수 있어요.'
            )
        ).toBeNull();
    });

    it('does not call onChange when disabled', () => {
        const onChange = vi.fn();
        render(
            <ReasoningToggle
                checked={false}
                onChange={onChange}
                visible={true}
                disabled={true}
            />
        );

        fireEvent.click(screen.getByRole('switch'));

        expect(onChange).not.toHaveBeenCalled();
    });
});
