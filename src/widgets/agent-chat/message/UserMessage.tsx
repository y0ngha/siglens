'use client';

/**
 * 질문 한 턴 — 오른쪽 말풍선과 그 아래 동작 줄, 또는 편집 중이면 그 자리의 편집 폼.
 */
import type { ReactNode, Ref } from 'react';

interface UserMessageProps {
    readonly content: string;
    /** 보낸 직후 이 노드를 화면 위로 올리려고 스크롤 훅이 잡는다. */
    readonly nodeRef: Ref<HTMLElement>;
    readonly minHeight: number | undefined;
    readonly actions: ReactNode;
    /** 있으면 말풍선·동작 줄 대신 이것(편집 폼)을 같은 턴 자리에 그린다. */
    readonly editor?: ReactNode;
}

/**
 * 턴 래퍼(스크롤 앵커 ref·활성 턴 최소 높이)는 말풍선과 편집 폼이 같이 쓴다 — 편집으로 바뀌어도
 * 앵커와 높이가 그대로다. 줄바꿈은 그대로 보여 준다(질문은 마크다운으로 읽지 않는다).
 */
export function UserMessage({
    content,
    nodeRef,
    minHeight,
    actions,
    editor,
}: UserMessageProps) {
    return (
        <article
            ref={nodeRef}
            data-role="user"
            style={minHeight === undefined ? undefined : { minHeight }}
            // hover로 동작 줄을 띄우는 `group`은 말풍선일 때만 — 편집 폼에는 동작 줄이 없다.
            className={
                editor === undefined
                    ? 'group flex flex-col items-end'
                    : 'flex flex-col items-end'
            }
        >
            {editor ?? (
                <>
                    <div className="surface-raised max-w-[80%] rounded-lg px-4 py-2.5 text-[15px] leading-6 break-words whitespace-pre-wrap text-secondary-100">
                        {content}
                    </div>
                    {actions}
                </>
            )}
        </article>
    );
}
