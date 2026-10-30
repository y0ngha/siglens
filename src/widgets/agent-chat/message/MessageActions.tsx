'use client';

/**
 * 메시지 아래 작은 동작 줄 — 복사, (마지막 답) 다시 생성, (마지막 질문) 편집.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';

/** 32px 높이 — 조용한 줄이지만 패딩과 함께 손가락 최소 크기에 닿는다. */
const ACTION =
    'inline-flex min-h-8 items-center gap-1 rounded px-1.5 text-xs text-secondary-400 hover:bg-secondary-800 hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

interface MessageActionsProps {
    readonly align: 'user' | 'assistant';
    readonly copied: boolean;
    readonly onCopy: () => void;
    /** 있으면 "다시 생성"을 그린다(마지막 답, 스트리밍 아님). */
    readonly onRegenerate?: () => void;
    /** 있으면 "편집"을 그린다(마지막 질문, 스트리밍 아님). */
    readonly onEdit?: () => void;
}

/** 동작 버튼은 언제나 DOM에 있다(키보드·스크린 리더). 넓은 화면에서만 hover/focus 때 떠오른다. */
export function MessageActions({
    align,
    copied,
    onCopy,
    onRegenerate,
    onEdit,
}: MessageActionsProps) {
    const t = useTranslations('widgets.agent-chat');
    return (
        <div
            className={cn(
                'mt-1 flex gap-0.5',
                align === 'user' ? 'justify-end' : 'ml-10',
                'sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100 motion-reduce:transition-none'
            )}
        >
            <button type="button" onClick={onCopy} className={ACTION}>
                {copied ? t('MessageList.copied') : t('MessageList.a55b1e')}
            </button>
            {onRegenerate !== undefined && (
                <button type="button" onClick={onRegenerate} className={ACTION}>
                    {t('MessageList.43da5e')}
                </button>
            )}
            {onEdit !== undefined && (
                <button type="button" onClick={onEdit} className={ACTION}>
                    {t('MessageList.e1407b')}
                </button>
            )}
        </div>
    );
}
