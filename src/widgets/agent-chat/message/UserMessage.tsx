'use client';

/**
 * 질문 한 턴 — 오른쪽 말풍선과 그 아래 동작 줄.
 */
import type { ReactNode, Ref } from 'react';

interface UserMessageProps {
    readonly content: string;
    /** 보낸 직후 이 노드를 화면 위로 올리려고 스크롤 훅이 잡는다. */
    readonly nodeRef: Ref<HTMLElement>;
    readonly minHeight: number | undefined;
    readonly actions: ReactNode;
}

/** 줄바꿈을 그대로 보여 준다 — 질문은 마크다운으로 읽지 않는다. */
export function UserMessage({
    content,
    nodeRef,
    minHeight,
    actions,
}: UserMessageProps) {
    return (
        <article
            ref={nodeRef}
            data-role="user"
            style={minHeight === undefined ? undefined : { minHeight }}
            className="group flex flex-col items-end"
        >
            <div className="surface-raised max-w-[80%] rounded-lg px-4 py-2.5 text-[15px] leading-6 break-words whitespace-pre-wrap text-secondary-100">
                {content}
            </div>
            {actions}
        </article>
    );
}
