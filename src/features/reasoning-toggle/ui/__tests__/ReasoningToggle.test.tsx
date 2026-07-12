import { render, screen, fireEvent } from '@testing-library/react';
import { ReasoningToggle } from '@/features/reasoning-toggle/ui/ReasoningToggle';
import { REASONING_FEATURE_LABEL } from '@/shared/lib/reasoningFeature';

vi.mock('@/shared/hooks/useEscapeKey', () => ({
    useEscapeKey: vi.fn(),
}));

vi.mock('@/shared/hooks/useOnClickOutside', () => ({
    useOnClickOutside: vi.fn(),
}));

vi.mock('@/shared/lib/tooltipPosition', () => ({
    getTooltipPosition: () => ({ top: 100, left: 200 }),
}));

const TOOLTIP_LINES = [
    'AI가 답을 내기 전에 여러 단계로 더 깊이 추론하는 기능이에요.',
    '켜면 지표·뉴스·시나리오를 더 꼼꼼히 따져 상세한 분석을 드려요.',
    '대신 분석에 시간이 조금 더 걸릴 수 있어요.',
];

function openTooltip() {
    fireEvent.click(screen.getByRole('button', { name: '추가 정보' }));
}

describe('ReasoningToggle', () => {
    it('is always rendered for non-members (canUse=false), not returning null', () => {
        const { container } = render(
            <ReasoningToggle
                checked={false}
                onChange={vi.fn()}
                canUse={false}
            />
        );
        expect(container.firstChild).not.toBeNull();
        expect(screen.getByRole('switch')).toBeDefined();
    });

    it('renders the "상세 분석" label for members', () => {
        render(
            <ReasoningToggle checked={false} onChange={vi.fn()} canUse={true} />
        );
        expect(screen.getByRole('switch')).toBeDefined();
        expect(screen.getByText(REASONING_FEATURE_LABEL)).toBeDefined();
    });

    it('renders the "상세 분석" label for non-members too', () => {
        render(
            <ReasoningToggle
                checked={false}
                onChange={vi.fn()}
                canUse={false}
            />
        );
        expect(screen.getByText(REASONING_FEATURE_LABEL)).toBeDefined();
    });

    it('uses the renamed aria-label for members', () => {
        render(
            <ReasoningToggle checked={false} onChange={vi.fn()} canUse={true} />
        );
        expect(screen.getByRole('switch').getAttribute('aria-label')).toBe(
            `${REASONING_FEATURE_LABEL} (추론) 토글`
        );
    });

    it('uses a gate-conveying aria-label for locked non-members', () => {
        render(
            <ReasoningToggle
                checked={false}
                onChange={vi.fn()}
                canUse={false}
            />
        );
        expect(screen.getByRole('switch').getAttribute('aria-label')).toBe(
            `${REASONING_FEATURE_LABEL} — 회원가입하면 사용할 수 있어요`
        );
    });

    it('shows an info tooltip with each explanatory sentence on its own line', () => {
        render(
            <ReasoningToggle checked={false} onChange={vi.fn()} canUse={true} />
        );
        openTooltip();
        for (const line of TOOLTIP_LINES) {
            expect(screen.getByText(line)).toBeInTheDocument();
        }
    });

    it('shows the info tooltip for non-members too', () => {
        render(
            <ReasoningToggle
                checked={false}
                onChange={vi.fn()}
                canUse={false}
            />
        );
        openTooltip();
        for (const line of TOOLTIP_LINES) {
            expect(screen.getByText(line)).toBeInTheDocument();
        }
    });

    it('no longer renders the old always/checked delay notice paragraph', () => {
        render(
            <ReasoningToggle checked={true} onChange={vi.fn()} canUse={true} />
        );
        expect(
            screen.queryByText(
                '추론을 켜면 상세 분석을 하느라 응답이 다소 지연될 수 있어요.'
            )
        ).toBeNull();
    });

    it('reflects checked=true via aria-checked for members', () => {
        render(
            <ReasoningToggle checked={true} onChange={vi.fn()} canUse={true} />
        );
        expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe(
            'true'
        );
    });

    it('reflects checked=false via aria-checked for members', () => {
        render(
            <ReasoningToggle checked={false} onChange={vi.fn()} canUse={true} />
        );
        expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe(
            'false'
        );
    });

    it('member: calls onChange with the toggled value on click', () => {
        const onChange = vi.fn();
        render(
            <ReasoningToggle
                checked={false}
                onChange={onChange}
                canUse={true}
            />
        );

        fireEvent.click(screen.getByRole('switch'));

        expect(onChange).toHaveBeenCalledWith(true);
    });

    it('member: does not call onChange when disabled', () => {
        const onChange = vi.fn();
        render(
            <ReasoningToggle
                checked={false}
                onChange={onChange}
                canUse={true}
                disabled={true}
            />
        );

        fireEvent.click(screen.getByRole('switch'));

        expect(onChange).not.toHaveBeenCalled();
    });

    it('non-member: switch renders locked (disabled-styled) and forced off, but NOT aria-disabled (it is still interactive)', () => {
        render(
            <ReasoningToggle
                checked={false}
                onChange={vi.fn()}
                canUse={false}
            />
        );
        const toggle = screen.getByRole('switch');
        // The locked switch stays interactive (clicking it opens the signup
        // nudge), so it must NOT report aria-disabled — that would tell
        // assistive tech the control cannot be activated.
        expect(toggle.hasAttribute('aria-disabled')).toBe(false);
        expect(toggle.getAttribute('aria-checked')).toBe('false');
        // The switch itself conveys "locked/unavailable": the muted track +
        // half opacity read as disabled, while it stays clickable
        // (cursor-pointer, not cursor-not-allowed, and no native `disabled`
        // attribute) — the switch carries the locked meaning.
        expect(toggle.className).toContain('opacity-50');
        expect(toggle.className).toContain('cursor-pointer');
        expect(toggle.hasAttribute('disabled')).toBe(false);
    });

    it('member: a genuinely disabled (no-op) switch reports aria-disabled', () => {
        render(
            <ReasoningToggle
                checked={false}
                onChange={vi.fn()}
                canUse={true}
                disabled={true}
            />
        );
        const toggle = screen.getByRole('switch');
        // Unlike `locked`, a `disabled` member switch is a true no-op, so
        // aria-disabled is correct here.
        expect(toggle.getAttribute('aria-disabled')).toBe('true');
    });

    it('non-member: no standalone lock icon is rendered (the switch carries the meaning)', () => {
        const { container } = render(
            <ReasoningToggle
                checked={false}
                onChange={vi.fn()}
                canUse={false}
            />
        );
        // Only the knob is aria-hidden; there is no separate lock <svg>.
        expect(container.querySelector('svg')).toBeNull();
    });

    it('non-member: a stale checked=true prop is still forced to the OFF state (aria-checked and knob position)', () => {
        render(
            <ReasoningToggle checked={true} onChange={vi.fn()} canUse={false} />
        );
        const toggle = screen.getByRole('switch');
        expect(toggle.getAttribute('aria-checked')).toBe('false');

        const knob = toggle.querySelector('span[aria-hidden="true"]');
        expect(knob).not.toBeNull();
        expect(knob?.className).toContain('translate-x-1');
        expect(knob?.className).not.toContain('translate-x-[18px]');
    });

    it('locked AND disabled: clicking is fully inert (neither onChange nor onLockedClick) and reports aria-disabled', () => {
        const onChange = vi.fn();
        const onLockedClick = vi.fn();
        render(
            <ReasoningToggle
                checked={false}
                onChange={onChange}
                canUse={false}
                disabled={true}
                onLockedClick={onLockedClick}
            />
        );

        const toggle = screen.getByRole('switch');
        // A genuine `disabled` takes precedence over `locked`: it is a true
        // no-op, so it must fire nothing on click — not even the locked nudge.
        expect(toggle.getAttribute('aria-disabled')).toBe('true');
        // The cursor must match that no-op behaviour: `disabled` wins, so it
        // reads as non-operable (cursor-not-allowed) rather than clickable.
        expect(toggle.className).toContain('cursor-not-allowed');
        expect(toggle.className).not.toContain('cursor-pointer');

        fireEvent.click(toggle);

        expect(onChange).not.toHaveBeenCalled();
        expect(onLockedClick).not.toHaveBeenCalled();
    });

    it('non-member: clicking the locked switch calls onLockedClick, not onChange', () => {
        const onChange = vi.fn();
        const onLockedClick = vi.fn();
        render(
            <ReasoningToggle
                checked={false}
                onChange={onChange}
                canUse={false}
                onLockedClick={onLockedClick}
            />
        );

        fireEvent.click(screen.getByRole('switch'));

        expect(onLockedClick).toHaveBeenCalledTimes(1);
        expect(onChange).not.toHaveBeenCalled();
    });
});
