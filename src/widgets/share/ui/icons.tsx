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
