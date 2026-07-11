'use client';

import { cn } from '@/shared/lib/cn';

interface ReasoningToggleProps {
    /** Current toggle value. */
    checked: boolean;
    onChange: (value: boolean) => void;
    /**
     * Member-only gating (member-reasoning-toggle spec Part A.4) — anonymous
     * and free-tier visitors never see this control. When `false` the
     * component renders nothing (not just disabled) so free/anon layouts stay
     * unchanged.
     */
    visible: boolean;
    disabled?: boolean;
    className?: string;
}

/**
 * "깊은 생각" (deep-thinking / reasoning) toggle — member-only control that
 * threads a per-request `reasoning: boolean` into every symbol analysis
 * submit (member-reasoning-toggle spec Part A). Mirrors `ModelSelector`'s
 * visual language so it reads as part of the same control cluster.
 */
export function ReasoningToggle({
    checked,
    onChange,
    visible,
    disabled = false,
    className,
}: ReasoningToggleProps) {
    if (!visible) return null;

    return (
        <div className={cn('flex flex-col gap-1', className)}>
            <label className="flex items-center gap-2">
                <span className="text-secondary-400 text-xs whitespace-nowrap">
                    깊은 생각
                </span>
                <button
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    aria-label="깊은 생각 (추론) 토글"
                    disabled={disabled}
                    onClick={() => onChange(!checked)}
                    className={cn(
                        'focus-visible:ring-primary-500 relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:ring-1 focus-visible:outline-none',
                        checked ? 'bg-primary-600' : 'bg-secondary-700',
                        disabled && 'cursor-not-allowed opacity-60'
                    )}
                >
                    <span
                        aria-hidden="true"
                        className={cn(
                            'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
                            checked ? 'translate-x-[18px]' : 'translate-x-1'
                        )}
                    />
                </button>
            </label>
            {checked && (
                <p className="text-secondary-500 text-[10px] leading-relaxed">
                    추론을 켜면 상세 분석을 하느라 응답이 다소 지연될 수 있어요.
                </p>
            )}
        </div>
    );
}
