'use client';

/**
 * 질문 한 턴 — 오른쪽 말풍선과 그 아래 동작 줄, 또는 편집 중이면 그 자리의 편집 폼.
 */
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { ReactNode, Ref } from 'react';
import type { ChatImageAttachment } from '@/features/agent-chat/model/types';

interface UserMessageProps {
    readonly content: string;
    /** 첨부한 이미지. 방금 보낸 것은 object URL, 저장된 대화는 `/api/ai/chat/images/<id>`다. */
    readonly images?: readonly ChatImageAttachment[];
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
    images = [],
    nodeRef,
    minHeight,
    actions,
    editor,
}: UserMessageProps) {
    const t = useTranslations('widgets.agent-chat');
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
                    {images.length > 0 && (
                        <ul
                            aria-label={t('UserMessage.imagesLabel')}
                            className="mb-2 flex max-w-[80%] flex-wrap justify-end gap-2"
                        >
                            {images.map((image, index) => (
                                <li key={image.id} className="size-24 shrink-0">
                                    {/* 새 탭에서 원본 크기로 연다. 상자 크기를 고정해 이미지가 오는 동안 줄이 흔들리지 않는다. */}
                                    <a
                                        href={image.src}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={t('UserMessage.openImage', {
                                            n: index + 1,
                                        })}
                                        className="block size-24 overflow-hidden rounded-lg focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                                    >
                                        <Image
                                            unoptimized
                                            src={image.src}
                                            alt={t('UserMessage.imageAlt', {
                                                n: index + 1,
                                            })}
                                            width={image.width}
                                            height={image.height}
                                            className="size-24 object-cover"
                                        />
                                    </a>
                                </li>
                            ))}
                        </ul>
                    )}
                    {content !== '' && (
                        <div className="surface-raised max-w-[80%] rounded-lg px-4 py-2.5 text-[15px] leading-6 break-words whitespace-pre-wrap text-secondary-100">
                            {content}
                        </div>
                    )}
                    {actions}
                </>
            )}
        </article>
    );
}
