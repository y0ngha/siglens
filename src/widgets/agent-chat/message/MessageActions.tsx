'use client';

/**
 * 메시지 아래 작은 동작 줄 — 복사, (마지막 답) 다시 생성, (마지막 질문) 편집, (끝난 답) 👍/👎.
 */
import { useTranslations } from 'next-intl';
import type { AgentMessageFeedbackTarget } from '@/features/ai-feedback/model/targets';
import { AiFeedbackButtons } from '@/features/ai-feedback/ui/AiFeedbackButtons';
import { cn } from '@/shared/lib/cn';
import { AI_HOVER_REVEAL } from '../aiSurfaceStyles';

/** 32px 높이 — 조용한 줄이지만 패딩과 함께 손가락 최소 크기에 닿는다. */
const ACTION =
    'inline-flex min-h-8 items-center gap-1 rounded px-1.5 text-xs text-secondary-400 hover:bg-secondary-800 hover:text-secondary-200 active:bg-secondary-800 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

interface MessageActionsProps {
    readonly align: 'user' | 'assistant';
    readonly copied: boolean;
    readonly onCopy: () => void;
    /** 있으면 "다시 생성"을 그린다(마지막 답, 스트리밍 아님). */
    readonly onRegenerate?: () => void;
    /** 있으면 "편집"을 그린다(마지막 질문, 스트리밍 아님). */
    readonly onEdit?: () => void;
    /**
     * 있으면 👍/👎를 그린다(끝난 assistant 답변). `resetKey`는 답변이 바뀌면(다시 생성) 눌러 둔
     * 평가를 비우는 기준으로 메시지 id를 넘긴다.
     */
    readonly feedback?: {
        readonly target: AgentMessageFeedbackTarget;
        readonly resetKey: string;
    };
}

/** 동작 버튼은 언제나 DOM에 있다(키보드·스크린 리더). 마우스 기기의 넓은 화면에서만 hover/focus 때 떠오르고, 터치 기기에서는 항상 보인다. */
export function MessageActions({
    align,
    copied,
    onCopy,
    onRegenerate,
    onEdit,
    feedback,
}: MessageActionsProps) {
    const t = useTranslations('widgets.agent-chat');
    return (
        <div
            className={cn(
                'mt-1 flex items-center gap-0.5',
                align === 'user' ? 'justify-end' : 'ml-10'
            )}
        >
            {/* hover로 드러나는 동작만 투명도를 준다. 👍/👎는 아래에 따로 둔다 - 👎 입력창이 이 줄의 자손이면
                마우스가 벗어날 때 투명해져 입력 중에 창이 사라진다. */}
            <div
                className={cn(
                    'flex gap-0.5',
                    AI_HOVER_REVEAL,
                    'sm:pointer-fine:transition-opacity motion-reduce:transition-none'
                )}
            >
                <button type="button" onClick={onCopy} className={ACTION}>
                    {copied ? t('MessageList.copied') : t('MessageList.a55b1e')}
                </button>
                {onRegenerate !== undefined && (
                    <button
                        type="button"
                        onClick={onRegenerate}
                        className={ACTION}
                    >
                        {t('MessageList.43da5e')}
                    </button>
                )}
                {onEdit !== undefined && (
                    <button type="button" onClick={onEdit} className={ACTION}>
                        {t('MessageList.e1407b')}
                    </button>
                )}
            </div>
            {feedback !== undefined && (
                <AiFeedbackButtons
                    target={feedback.target}
                    resetKey={feedback.resetKey}
                    popoverPlacement="above"
                />
            )}
        </div>
    );
}
