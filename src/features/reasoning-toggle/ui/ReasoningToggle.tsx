'use client';

import { cn } from '@/shared/lib/cn';
import { REASONING_FEATURE_LABEL } from '@/shared/lib/reasoningFeature';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';

interface ReasoningToggleProps {
    /** Current toggle value. */
    checked: boolean;
    onChange: (value: boolean) => void;
    /**
     * Member gating (member-reasoning-toggle spec Part A.4) — anonymous and
     * free-tier visitors still see the control, but it renders in a
     * locked/disabled visual state instead of being hidden. This lets
     * everyone discover the feature via the ⓘ tooltip and the free-tier
     * signup nudge (`onLockedClick`) instead of the control simply vanishing.
     */
    canUse: boolean;
    /**
     * Called instead of `onChange` when a non-member (`canUse=false`) clicks
     * the locked switch. Wired to open the signup nudge modal by the caller.
     */
    onLockedClick?: () => void;
    disabled?: boolean;
    className?: string;
}

/**
 * "상세 분석" (deep-thinking / reasoning) toggle — threads a per-request
 * `reasoning: boolean` into every symbol analysis submit
 * (member-reasoning-toggle spec Part A). Mirrors `ModelSelector`'s visual
 * language so it reads as part of the same control cluster.
 *
 * Always rendered regardless of tier: members can flip it freely, non-members
 * see a locked switch that opens a signup nudge on click instead of toggling.
 */
export function ReasoningToggle({
    checked,
    onChange,
    canUse,
    onLockedClick,
    disabled = false,
    className,
}: ReasoningToggleProps) {
    const locked = !canUse;
    // Locked non-members never actually have reasoning enabled server-side,
    // so the switch always reads as OFF regardless of the raw `checked` prop
    // (which may still hold a member's previously-persisted preference).
    const effectiveChecked = locked ? false : checked;
    // Locked is still clickable (it opens the signup nudge), so its
    // accessible name must say "signup unlocks this" rather than the generic
    // toggle label — otherwise a screen reader user has no way to know why
    // activating it doesn't flip the switch.
    const ariaLabel = locked
        ? `${REASONING_FEATURE_LABEL} — 회원가입하면 사용할 수 있어요`
        : `${REASONING_FEATURE_LABEL} (추론) 토글`;

    const handleClick = (): void => {
        // A genuine `disabled` is a full no-op and takes precedence: it reports
        // aria-disabled (non-operable to AT), so it must fire NOTHING on click —
        // not even the locked signup nudge — otherwise the control would
        // contradict its own aria-disabled state.
        if (disabled) return;
        if (locked) {
            onLockedClick?.();
            return;
        }
        onChange(!checked);
    };

    return (
        <div className={cn('flex items-center gap-1.5', className)}>
            <span className="text-secondary-400 text-xs whitespace-nowrap">
                {REASONING_FEATURE_LABEL}
            </span>
            <InfoTooltip>
                <p className="mb-1">
                    AI가 답을 내기 전에 여러 단계로 더 깊이 추론하는 기능이에요.
                </p>
                <p className="mb-1">
                    켜면 지표·뉴스·시나리오를 더 꼼꼼히 따져 상세한 분석을
                    드려요.
                </p>
                <p>대신 분석에 시간이 조금 더 걸릴 수 있어요.</p>
            </InfoTooltip>
            <button
                type="button"
                role="switch"
                aria-checked={effectiveChecked}
                aria-label={ariaLabel}
                // Only the genuine `disabled` (true no-op) case is non-operable.
                // A `locked` non-member switch is still interactive (clicking it
                // opens the signup nudge), so it must NOT report aria-disabled —
                // that would tell assistive tech the control can't be activated.
                aria-disabled={disabled || undefined}
                onClick={handleClick}
                className={cn(
                    'focus-visible:ring-primary-500 relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:ring-1 focus-visible:outline-none',
                    effectiveChecked ? 'bg-primary-600' : 'bg-secondary-700',
                    // A genuine `disabled` (true no-op) always wins the cursor:
                    // it must read as non-operable (cursor-not-allowed) even when
                    // also locked, so this precedence matches `handleClick`, where
                    // `disabled` short-circuits before the locked branch.
                    disabled && 'cursor-not-allowed opacity-60',
                    // Locked non-members: the switch itself carries the
                    // "unavailable" meaning through the muted track + reduced
                    // opacity — there is no separate lock affordance. It stays
                    // clickable so the click opens the signup nudge
                    // (cursor-pointer, not cursor-not-allowed; no native
                    // `disabled` which would swallow onClick).
                    locked &&
                        !disabled &&
                        'bg-secondary-800 cursor-pointer opacity-50'
                )}
            >
                <span
                    aria-hidden="true"
                    className={cn(
                        'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
                        effectiveChecked
                            ? 'translate-x-[18px]'
                            : 'translate-x-1'
                    )}
                />
            </button>
        </div>
    );
}
