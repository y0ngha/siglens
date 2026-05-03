'use client';

interface Props {
    /** Korean label for the page the chatbot context switched to. */
    label: string;
}

/**
 * System message bubble shown in the chat flow when the chatbot's
 * page-level analysis context changes (e.g. user navigates from
 * the chart page to the fundamentals page).
 *
 * Rendered inline between conversation turns — not a modal or banner.
 */
export function ContextSwitchSystemMessage({ label }: Props) {
    return (
        <div
            className="bg-secondary-800 text-secondary-300 my-2 rounded-md px-3 py-2 text-xs"
            role="status"
            aria-live="polite"
        >
            📊 {label} 페이지로 전환되었습니다. 이전 페이지의 분석 컨텍스트는 더
            이상 적용되지 않습니다.
        </div>
    );
}
