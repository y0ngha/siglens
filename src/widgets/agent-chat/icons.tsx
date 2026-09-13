import type { ReactNode } from 'react';

/**
 * Stroke icons for the chat surface (24px grid, 1.75 stroke). Inline SVG
 * rather than emoji: emoji render per-platform, ignore the theme's text
 * colour and read as placeholders next to the brand's mono wordmark.
 */
interface IconFrameProps {
    readonly children: ReactNode;
    readonly className?: string;
}

function Icon({ children, className = 'size-4' }: IconFrameProps) {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className={className}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {children}
        </svg>
    );
}

interface IconProps {
    readonly className?: string;
}

export const PlusIcon = (p: IconProps) => (
    <Icon {...p}>
        <path d="M12 5v14M5 12h14" />
    </Icon>
);
export const MenuIcon = (p: IconProps) => (
    <Icon {...p}>
        <path d="M4 7h16M4 12h16M4 17h10" />
    </Icon>
);
export const PencilIcon = (p: IconProps) => (
    <Icon {...p}>
        <path d="M4 20h4L19 9l-4-4L4 16v4z" />
        <path d="M13.5 6.5l4 4" />
    </Icon>
);
export const TrashIcon = (p: IconProps) => (
    <Icon {...p}>
        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </Icon>
);
export const ArrowUpRightIcon = (p: IconProps) => (
    <Icon {...p}>
        <path d="M7 17L17 7M9 7h8v8" />
    </Icon>
);
export const ChevronDownIcon = (p: IconProps) => (
    <Icon {...p}>
        <path d="M6 9l6 6 6-6" />
    </Icon>
);
export const CheckIcon = (p: IconProps) => (
    <Icon {...p}>
        <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Icon>
);
export const SearchIcon = (p: IconProps) => (
    <Icon {...p}>
        <circle cx="11" cy="11" r="6.5" />
        <path d="M20 20l-4.2-4.2" />
    </Icon>
);
export const QuoteIcon = (p: IconProps) => (
    <Icon {...p}>
        <path d="M3 17l5-5 4 4 8-8" />
        <path d="M15 8h5v5" />
    </Icon>
);
export const CandlesIcon = (p: IconProps) => (
    <Icon {...p}>
        <path d="M7 3v4M7 17v4M17 3v6M17 17v4" />
        <rect x="4.5" y="7" width="5" height="10" rx="1" />
        <rect x="14.5" y="9" width="5" height="8" rx="1" />
    </Icon>
);
export const SparkIcon = (p: IconProps) => (
    <Icon {...p}>
        <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
        <path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" />
    </Icon>
);
export const NewsIcon = (p: IconProps) => (
    <Icon {...p}>
        <rect x="3.5" y="5" width="13" height="14" rx="1.5" />
        <path d="M16.5 9h4v8.5a1.5 1.5 0 01-3 0V9M7 9h6M7 12.5h6M7 16h4" />
    </Icon>
);
export const OptionsIcon = (p: IconProps) => (
    <Icon {...p}>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="0.5" />
    </Icon>
);
export const PortfolioIcon = (p: IconProps) => (
    <Icon {...p}>
        <rect x="3.5" y="7" width="17" height="12" rx="1.5" />
        <path d="M9 7V5h6v2M3.5 12h17" />
    </Icon>
);
export const RefreshIcon = (p: IconProps) => (
    <Icon {...p}>
        <path d="M20 11a8 8 0 00-14.5-4.5L4 8M4 13a8 8 0 0014.5 4.5L20 16" />
        <path d="M4 4v4h4M20 20v-4h-4" />
    </Icon>
);
export const GlobeIcon = (p: IconProps) => (
    <Icon {...p}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z" />
    </Icon>
);
