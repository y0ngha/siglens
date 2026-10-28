'use client';

/**
 * 마지막 질문 편집 폼 — 입력창과 같은 규칙(앞뒤 공백 제거, 빈 내용 금지, 글자 수 한도)으로만 보낸다.
 */
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { BUTTON_GHOST, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { isSendableMessage } from '../utils/messageLimits';

const EDIT_ACTION_SIZE = 'min-h-9 px-3 text-sm';

interface EditMessageFormProps {
    readonly initialText: string;
    /** 다듬은(trim) 내용으로 부른다. */
    readonly onSave: (text: string) => void;
    readonly onCancel: () => void;
}

/**
 * 비었거나 한도를 넘는 내용은 저장할 수 없다 — 그대로 보내면 훅이 먼저 대화를 그 빈/넘친 말풍선까지
 * 잘라 낸 뒤 서버가 `invalid_body`(재시도 불가)로 거부해, 편집 버튼까지 사라진 채 남았다.
 */
export function EditMessageForm({
    initialText,
    onSave,
    onCancel,
}: EditMessageFormProps) {
    const t = useTranslations('widgets.agent-chat');
    const [text, setText] = useState(initialText);
    const canSave = isSendableMessage(text);
    return (
        <form
            onSubmit={e => {
                e.preventDefault();
                if (canSave) onSave(text.trim());
            }}
            className="surface-raised flex w-full max-w-[80%] flex-col gap-2 rounded-lg p-2 focus-within:ring-2 focus-within:ring-primary-500"
        >
            <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                rows={3}
                aria-label={t('MessageList.e6b008')}
                className="min-h-20 w-full resize-y bg-transparent px-2 py-1.5 text-[15px] leading-6 text-secondary-100 focus-visible:outline-none"
            />
            <div className="flex justify-end gap-1.5">
                <button
                    type="button"
                    onClick={onCancel}
                    className={cn(BUTTON_GHOST, EDIT_ACTION_SIZE)}
                >
                    {t('MessageList.19b2d1')}
                </button>
                <button
                    type="submit"
                    disabled={!canSave}
                    className={cn(BUTTON_PRIMARY, EDIT_ACTION_SIZE)}
                >
                    {t('MessageList.6523ca')}
                </button>
            </div>
        </form>
    );
}
