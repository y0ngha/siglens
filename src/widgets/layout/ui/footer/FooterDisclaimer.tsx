import type { ReactNode } from 'react';

interface FooterDisclaimerProps {
    /** `note` 역할의 이름. */
    readonly label: string;
    readonly children: ReactNode;
}

/** 구분선 아래 자기 줄을 갖는 투자 면책 고지. */
export function FooterDisclaimer({ label, children }: FooterDisclaimerProps) {
    return (
        <div
            role="note"
            aria-label={label}
            className="mt-10 border-t border-secondary-700 pt-6 text-xs leading-relaxed text-secondary-400"
        >
            {children}
        </div>
    );
}
