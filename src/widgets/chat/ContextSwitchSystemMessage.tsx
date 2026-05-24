interface ContextSwitchSystemMessageProps {
    /** Korean label for the page the chatbot context switched to. */
    label: string;
}

/** Inline system message shown between chat turns when the page-level analysis context changes. */
export function ContextSwitchSystemMessage({
    label,
}: ContextSwitchSystemMessageProps) {
    return (
        <div
            className="bg-secondary-800 text-secondary-300 my-2 rounded-md px-3 py-2 text-xs"
            role="status"
        >
            {label} 페이지로 전환되었습니다. 이전 페이지의 분석 컨텍스트는 더
            이상 적용되지 않습니다.
        </div>
    );
}
