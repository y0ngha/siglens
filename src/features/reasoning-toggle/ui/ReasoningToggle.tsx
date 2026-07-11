'use client';

import { cn } from '@/shared/lib/cn';
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
    const isDisabled = locked || disabled;
    // Locked is still clickable (it opens the signup nudge), so its
    // accessible name must say "signup unlocks this" rather than the generic
    // toggle label — otherwise a screen reader user has no way to know why
    // activating it doesn't flip the switch.
    const ariaLabel = locked
        ? '상세 분석 — 회원가입하면 사용할 수 있어요'
        : '상세 분석 (추론) 토글';

    const handleClick = (): void => {
        if (locked) {
            onLockedClick?.();
            return;
        }
        if (disabled) return;
        onChange(!checked);
    };

    return (
        <div className={cn('flex items-center gap-1.5', className)}>
            <span className="text-secondary-400 text-xs whitespace-nowrap">
                상세 분석
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
                aria-disabled={isDisabled || undefined}
                onClick={handleClick}
                className={cn(
                    'focus-visible:ring-primary-500 relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:ring-1 focus-visible:outline-none',
                    effectiveChecked ? 'bg-primary-600' : 'bg-secondary-700',
                    // Locked non-members: the switch itself now carries the
                    // "unavailable" meaning (the standalone lock icon was
                    // removed), so render it visibly disabled — muted track +
                    // half opacity, OFF knob — while staying clickable so the
                    // click opens the signup nudge (cursor-pointer, not
                    // cursor-not-allowed; no native `disabled` which would swallow onClick).
                    locked && 'bg-secondary-800 cursor-pointer opacity-50',
                    !locked && disabled && 'cursor-not-allowed opacity-60'
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
