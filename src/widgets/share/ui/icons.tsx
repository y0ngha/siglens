import { cn } from '@/shared/lib/cn';

interface IconProps {
    className?: string;
}

/** Share / upload arrow icon (20×20, house style). */
export function ShareIcon({ className = 'h-5 w-5' }: IconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={className}
            aria-hidden
        >
            <path d="M13 4.5a2.5 2.5 0 1 1 .702 1.737L6.97 9.604a2.518 2.518 0 0 1 0 .792l6.733 3.367a2.5 2.5 0 1 1-.671 1.341l-6.733-3.367a2.5 2.5 0 1 1 0-3.474l6.733-3.367A2.52 2.52 0 0 1 13 4.5Z" />
        </svg>
    );
}

/** Link / chain icon (20×20, house style). */
export function LinkIcon({ className = 'h-5 w-5' }: IconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={className}
            aria-hidden
        >
            <path
                fillRule="evenodd"
                d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z"
                clipRule="evenodd"
            />
            <path
                fillRule="evenodd"
                d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z"
                clipRule="evenodd"
            />
        </svg>
    );
}

/** Check / tick icon (20×20, house style). */
export function CheckIcon({ className = 'h-5 w-5' }: IconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={className}
            aria-hidden
        >
            <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                clipRule="evenodd"
            />
        </svg>
    );
}

/** X (formerly Twitter) logo icon (20×20, house style). */
export function XLogoIcon({ className = 'h-5 w-5' }: IconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={className}
            aria-hidden
        >
            {/* X logo paths derived from the official X brand mark */}
            <path d="M11.72 8.515 17.785 1.5h-1.44L11.09 7.608 7.03 1.5H2.25l6.37 9.273L2.25 18.5h1.44l5.567-6.476 4.445 6.476H18.25L11.72 8.515Zm-1.97 2.29-.645-.923-5.13-7.336H6.35l4.143 5.927.645.923 5.387 7.71h-2.375l-4.4-6.3Z" />
        </svg>
    );
}

/**
 * Animated spinner icon (20×20, house style).
 * Uses Tailwind's `animate-spin` class for the rotation animation.
 * Respects `prefers-reduced-motion` via the global `motion-reduce:animate-none` Tailwind variant.
 */
export function SpinnerIcon({ className = 'h-5 w-5' }: IconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="none"
            className={cn('animate-spin motion-reduce:animate-none', className)}
            aria-hidden
        >
            {/* Background track */}
            <circle
                cx="10"
                cy="10"
                r="8"
                stroke="currentColor"
                strokeOpacity="0.25"
                strokeWidth="2.5"
            />
            {/* Spinning arc */}
            <path
                d="M18 10a8 8 0 0 0-8-8"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
            />
        </svg>
    );
}
