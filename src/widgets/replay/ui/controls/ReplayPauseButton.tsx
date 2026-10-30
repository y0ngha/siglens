/** The stop control every auto-playing replay needs (WCAG 2.2.2). */

interface ReplayPauseButtonProps {
    readonly paused: boolean;
    readonly onToggle: () => void;
    readonly pauseLabel: string;
    readonly resumeLabel: string;
}

/**
 * An action button whose visible text names what pressing it does next
 * ("Pause" while playing, "Play" while paused). It carries no `aria-pressed`:
 * the name already changes with the state, and adding a pressed state on top
 * would announce it twice and inverted ("Play, pressed").
 */
export function ReplayPauseButton({
    paused,
    onToggle,
    pauseLabel,
    resumeLabel,
}: ReplayPauseButtonProps) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className="inline-flex min-h-8 items-center rounded-lg border border-border-control px-2.5 text-xs text-secondary-300 hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
        >
            {paused ? resumeLabel : pauseLabel}
        </button>
    );
}
