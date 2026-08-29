import { useTranslations } from 'next-intl';
interface ContextSwitchSystemMessageProps {
    /** Korean label for the page the chatbot context switched to. */
    label: string;
}

/** Inline system message shown between chat turns when the page-level analysis context changes. */
export function ContextSwitchSystemMessage({
    label,
}: ContextSwitchSystemMessageProps) {
    const t = useTranslations('widgets.chat');
    return (
        <div
            className="my-2 rounded-lg bg-secondary-800 px-3 py-2 text-xs text-secondary-300"
            role="status"
        >
            {t('ContextSwitchSystemMessage.aa779e', { v0: label })}
        </div>
    );
}
