'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import {
    useEffect,
    useRef,
    useState,
    type ClipboardEvent,
    type DragEvent,
    type KeyboardEvent,
} from 'react';
import type { ChatImageAttachment } from '@/features/agent-chat/model/types';
import {
    CHAT_IMAGE_ACCEPT_TYPES,
    CHAT_IMAGES_PER_MESSAGE_MAX,
} from '@/shared/config/chatImages';
import { COARSE_POINTER_MEDIA_QUERY } from '@/shared/config/viewport';
import { cn } from '@/shared/lib/cn';
import { BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { ArrowUpIcon, CloseIcon, ImageIcon } from '@/shared/ui/StrokeIcons';
import {
    AI_FIELD_TOUCH_TEXT,
    AI_PRESS_FEEDBACK,
    AI_RAISED_CONTROL,
} from './aiSurfaceStyles';
import {
    useImageAttachments,
    type ImageNotice,
} from './hooks/useImageAttachments';
import { useMediaQuery } from './hooks/useMediaQuery';
import type { RestoredDraft } from '@/features/agent-chat/hooks/useAgentStream';
import {
    isSendableMessage,
    MESSAGE_MAX_CHARS,
} from '@/features/agent-chat/lib/messageLimits';

/** The counter stays hidden until the message is long enough that the cap is a real concern. */
const COUNTER_VISIBLE_FROM = MESSAGE_MAX_CHARS * 0.8;

interface Props {
    readonly disabled: boolean;
    readonly streaming: boolean;
    readonly remainingTurns: number | null;
    /** `images`: 입력창에 붙어 있던 첨부 — 말풍선이 object URL을 이어 받는다. */
    readonly onSend: (
        text: string,
        images: readonly ChatImageAttachment[]
    ) => void;
    readonly onStop: () => void;
    /** Prefilled text (an entry link's `?q=`); the user still presses send. */
    readonly initialValue?: string;
    /**
     * 서버가 이미지를 거절해 사라진 질문의 글. `id`가 바뀔 때마다 입력창에 되돌린다 — 사용자는 이미지만 바꿔 다시
     * 보낸다(`useAgentStream`의 `restoredDraft`).
     */
    readonly restoredDraft?: RestoredDraft | null;
}

/** 44px hit target that sits flush inside the surface; both actions share it so the box never jumps when a turn starts or stops. */
const ACTION_SIZE = 'size-11 shrink-0';

/** 첨부 파일 선택창이 받는 형식 — 서버 정규화도 같은 목록(+실제 포맷 확인)을 받는다. */
const IMAGE_ACCEPT = CHAT_IMAGE_ACCEPT_TYPES.join(',');

/** 첨부 썸네일 상자 — 크기를 고정해 이미지가 로드되는 동안·뒤에 줄이 흔들리지 않는다. */
const THUMB_BOX = 'size-16';

/** 끌어온 항목에 파일이 있는가(텍스트 끌기는 입력창이 기본 동작으로 처리한다). */
function dragHasFiles(e: DragEvent): boolean {
    return Array.from(e.dataTransfer.types).includes('Files');
}

function imageFilesOf(files: FileList | null | undefined): File[] {
    return Array.from(files ?? []).filter(file =>
        file.type.startsWith('image/')
    );
}

/** No stroke equivalent in StrokeIcons — a filled square is the stop grammar users know. */
function StopIcon() {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="size-4"
            fill="currentColor"
        >
            <rect x="4" y="4" width="12" height="12" rx="2" />
        </svg>
    );
}

const TEXTAREA_MAX_HEIGHT_PX = 160;

/** 내용 높이에 맞추되 `max-h-40`(160px) 상한까지만 키운다. */
function fitTextareaHeight(el: HTMLTextAreaElement): void {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT_PX)}px`;
}

/**
 * One surface holds the textarea and the action button (send while idle,
 * stop while streaming) — the chat-product grammar users already know. The
 * surface, not the textarea, carries the focus ring so the ring wraps the
 * whole control instead of drawing a box inside a box.
 */
export function Composer({
    disabled,
    streaming,
    remainingTurns,
    onSend,
    onStop,
    initialValue = '',
    restoredDraft = null,
}: Props) {
    const t = useTranslations('widgets.agent-chat');
    const [text, setText] = useState(() =>
        initialValue.slice(0, MESSAGE_MAX_CHARS)
    );
    // 렌더 중 이전 prop과 비교해 상태를 맞춘다(effect로 한 프레임 늦게 덮지 않는다).
    const [restoredId, setRestoredId] = useState(restoredDraft?.id ?? null);
    if (restoredDraft !== null && restoredDraft.id !== restoredId) {
        setRestoredId(restoredDraft.id);
        setText(restoredDraft.text.slice(0, MESSAGE_MAX_CHARS));
    }
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    // 복원된 글은 `onInput`을 거치지 않아 높이가 접힌 채로 남는다 — DOM에 글이 들어간 뒤(effect) 높이를 다시 맞춘다.
    useEffect(() => {
        if (restoredId !== null && textareaRef.current !== null)
            fitTextareaHeight(textareaRef.current);
    }, [restoredId]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const images = useImageAttachments();
    const [dragging, setDragging] = useState(false);
    // 터치 키보드에는 Shift가 없어 Enter 전송이면 여러 줄 질문을 쓸 수 없다. 네이티브 채팅 앱처럼
    // 터치 기기의 Enter는 줄바꿈이고 전송은 버튼으로만 한다. 하이드레이션 전에는 `false`라
    // 데스크톱 동작으로 시작하지만, 그 사이에는 입력 이벤트가 붙지 않아 차이가 없다.
    const isTouch = useMediaQuery(COARSE_POINTER_MEDIA_QUERY);
    const overLimit = text.length > MESSAGE_MAX_CHARS;
    const hasImages = images.attachments.length > 0;
    // 이미지가 있으면 글이 비어도 보낼 수 있다(길이 상한은 그대로).
    const hasSendableContent = hasImages
        ? text.trim().length <= MESSAGE_MAX_CHARS
        : isSendableMessage(text);
    const canSend =
        !disabled && !streaming && !images.processing && hasSendableContent;
    const submit = (): void => {
        if (!canSend) return;
        onSend(text.trim(), images.takeAll());
        setText('');
        const el = textareaRef.current;
        if (el) {
            // Collapse the grown box back to one row and keep the caret here so
            // the user can keep typing while the reply streams in.
            el.style.height = 'auto';
            el.focus();
        }
    };
    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
        if (isTouch) return;
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
        }
    };
    const pickFiles = (files: FileList | null | undefined): void => {
        const picked = imageFilesOf(files);
        if (picked.length > 0) void images.addFiles(picked);
    };
    const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>): void => {
        const pasted = imageFilesOf(e.clipboardData.files);
        if (pasted.length === 0) return;
        // 스크린샷 붙여넣기는 파일만 온다. Excel·Sheets·Word는 셀·문단 텍스트와 그 렌더 이미지를 함께
        // 싣는데, 이때 막으면 텍스트가 사라진다 — 글이 있으면 기본 붙여넣기에 맡기고 이미지는 붙이지 않는다.
        if (e.clipboardData.getData('text/plain').trim() !== '') return;
        e.preventDefault();
        void images.addFiles(pasted);
    };
    const onDragOver = (e: DragEvent): void => {
        if (!disabled && dragHasFiles(e)) e.preventDefault();
    };
    const onDragEnter = (e: DragEvent): void => {
        if (!disabled && dragHasFiles(e)) setDragging(true);
    };
    const onDragLeave = (e: DragEvent): void => {
        // 자식 요소로 옮겨 가는 것은 떠난 것이 아니다.
        const next = e.relatedTarget;
        if (!(next instanceof Node && e.currentTarget.contains(next)))
            setDragging(false);
    };
    const onDrop = (e: DragEvent): void => {
        setDragging(false);
        if (disabled || !dragHasFiles(e)) return;
        e.preventDefault();
        pickFiles(e.dataTransfer.files);
    };
    const noticeText = (notice: ImageNotice): string => {
        if (notice.kind === 'limit')
            return t('Composer.imageLimit', {
                max: CHAT_IMAGES_PER_MESSAGE_MAX,
            });
        if (notice.kind === 'too_large')
            return t('Composer.imageTooLarge', { name: notice.name });
        if (notice.kind === 'unsupported')
            return t('Composer.imageUnsupported', { name: notice.name });
        return t('Composer.imageUnreadable', { name: notice.name });
    };
    const attachFull = images.attachments.length >= CHAT_IMAGES_PER_MESSAGE_MAX;
    return (
        // The fade lets the transcript scroll under the composer instead of
        // being cut by a hard edge.
        <div className="sticky bottom-0 bg-gradient-to-t from-secondary-900 from-70% to-transparent px-4 pt-6 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
            <div
                className={cn(
                    // Documented exception to "input boundary = border-control"
                    // (docs/conventions/DESIGN.md §경계 예외): the chat composer is
                    // identified by its fixed bottom position, placeholder, filled
                    // send button and its raised surface (`surface-raised`: solid face +
                    // top highlight in dark, gradient + shadow in light), so it
                    // draws no edge line; focus draws the brand ring. The 3.5:1 control edge read as a detached white box on
                    // the dark page (2026-09-13 사용자 제보). The transparent border
                    // keeps the box size fixed when the over-limit red edge appears.
                    SURFACE_CARD,
                    'mx-auto flex w-full max-w-3xl flex-col p-1.5',
                    'focus-within:ring-2 focus-within:ring-primary-500',
                    dragging && 'ring-2 ring-primary-500',
                    overLimit && 'border-ui-danger'
                )}
                onDragOver={onDragOver}
                onDragEnter={onDragEnter}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
            >
                {hasImages && (
                    <ul
                        aria-label={t('Composer.attachedImages')}
                        className="flex flex-wrap gap-3 px-1.5 pt-3 pb-1.5"
                    >
                        {images.attachments.map((image, index) => (
                            <li
                                key={image.id}
                                className={cn(THUMB_BOX, 'relative shrink-0')}
                            >
                                {/* 사용자 기기의 object URL이라 최적화 대상이 아니다(`unoptimized`). */}
                                <Image
                                    unoptimized
                                    src={image.src}
                                    alt={t('Composer.imageAlt', {
                                        n: index + 1,
                                    })}
                                    width={image.width}
                                    height={image.height}
                                    className={cn(
                                        THUMB_BOX,
                                        'rounded-lg object-cover'
                                    )}
                                />
                                {/* 44px 터치 타깃 — 보이는 원은 작게, 누르는 영역은 썸네일 모서리 밖으로 넓힌다. */}
                                <button
                                    type="button"
                                    onClick={() => images.remove(image.id)}
                                    aria-label={t('Composer.removeImage', {
                                        n: index + 1,
                                    })}
                                    className="absolute -top-3.5 -right-3.5 inline-flex size-11 touch-manipulation items-center justify-center rounded-full text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                                >
                                    <span className="surface-raised inline-flex size-5 items-center justify-center rounded-full">
                                        <CloseIcon className="size-3" />
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                <div className="flex items-end gap-1">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={IMAGE_ACCEPT}
                        multiple
                        hidden
                        tabIndex={-1}
                        onChange={e => {
                            pickFiles(e.currentTarget.files);
                            // 같은 파일을 지웠다가 다시 고를 수 있게 비운다.
                            e.currentTarget.value = '';
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={disabled || attachFull}
                        aria-label={t('Composer.attachImage')}
                        className={cn(
                            AI_RAISED_CONTROL,
                            ACTION_SIZE,
                            'inline-flex touch-manipulation items-center justify-center rounded-lg text-secondary-200 disabled:cursor-not-allowed disabled:text-secondary-500'
                        )}
                    >
                        <ImageIcon className="size-5" />
                    </button>
                    <textarea
                        ref={textareaRef}
                        name="message"
                        value={text}
                        onChange={e => setText(e.target.value)}
                        onKeyDown={onKeyDown}
                        onPaste={onPaste}
                        rows={1}
                        disabled={disabled}
                        autoComplete="off"
                        enterKeyHint={isTouch ? 'enter' : 'send'}
                        aria-label={t('Composer.fdad68')}
                        aria-invalid={overLimit || undefined}
                        placeholder={t('Composer.placeholder')}
                        className={cn(
                            'max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2.5 py-2.5 text-[15px] leading-6 text-secondary-100 placeholder:text-secondary-400 focus-visible:outline-none',
                            AI_FIELD_TOUCH_TEXT
                        )}
                        onInput={e => fitTextareaHeight(e.currentTarget)}
                    />
                    {streaming ? (
                        <button
                            type="button"
                            onClick={onStop}
                            aria-label={t('Composer.d2e7e7')}
                            // A raised button inside the raised composer — its icon labels
                            // it, so it needs no outline (the outline was the last line left
                            // in the composer). AI_RAISED_CONTROL, not a BUTTON_* tone: see
                            // aiSurfaceStyles.ts.
                            className={cn(
                                AI_RAISED_CONTROL,
                                ACTION_SIZE,
                                'inline-flex touch-manipulation items-center justify-center rounded-lg text-secondary-200'
                            )}
                        >
                            <StopIcon />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={submit}
                            disabled={!canSend}
                            aria-label={t('Composer.4077ce')}
                            className={cn(
                                BUTTON_PRIMARY,
                                ACTION_SIZE,
                                'surface-accent',
                                AI_PRESS_FEEDBACK
                            )}
                        >
                            <ArrowUpIcon className="size-5" />
                        </button>
                    )}
                </div>
            </div>
            {images.notice !== null && (
                <p
                    role="status"
                    className="mx-auto mt-1.5 w-full max-w-3xl text-xs text-ui-danger-text"
                >
                    {noticeText(images.notice)}
                </p>
            )}
            {hasImages && (
                <p className="mx-auto mt-1.5 w-full max-w-3xl text-xs text-secondary-400">
                    {t('Composer.imagePrivacyHint')}
                </p>
            )}
            <p className="mx-auto mt-1.5 flex w-full max-w-3xl items-baseline justify-between gap-3 text-xs text-secondary-400">
                <span className="truncate">
                    {overLimit ? (
                        <span className="text-ui-danger-text">
                            {t('Composer.tooLong', {
                                len: text.length.toLocaleString(),
                                max: MESSAGE_MAX_CHARS.toLocaleString(),
                            })}
                        </span>
                    ) : text.length >= COUNTER_VISIBLE_FROM ? (
                        <span className="tabular-nums">
                            {t('Composer.charCount', {
                                len: text.length.toLocaleString(),
                                max: MESSAGE_MAX_CHARS.toLocaleString(),
                            })}
                        </span>
                    ) : (
                        // Enter·Shift+Enter 안내는 물리 키보드 기기에만 맞는 말이다.
                        <span className="hidden sm:pointer-fine:inline">
                            {t('Composer.keyHint')}
                        </span>
                    )}
                </span>
                <span className="shrink-0 text-right">
                    {remainingTurns !== null
                        ? t('Composer.remainingTurns', { n: remainingTurns })
                        : ''}
                    {t('Composer.betaNotice')}
                </span>
            </p>
        </div>
    );
}
