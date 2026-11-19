'use client';

import { useEffect, useRef, useState } from 'react';
import { prepareChatImage } from '@/features/agent-chat/lib/prepareChatImage';
import type { ChatImageAttachment } from '@/features/agent-chat/model/types';
import { CHAT_IMAGES_PER_MESSAGE_MAX } from '@/shared/config/chatImages';

/** 입력창 아래에 한 줄로 보이는 첨부 안내. `name`은 거절된 파일 이름. */
export type ImageNotice =
    | { readonly kind: 'limit' }
    | {
          readonly kind: 'too_large' | 'unreadable' | 'unsupported';
          readonly name: string;
      };

export interface ImageAttachments {
    readonly attachments: readonly ChatImageAttachment[];
    readonly notice: ImageNotice | null;
    /** 파일을 줄이는 중 — 전송을 잠시 막는다(끝나기 전에 보내면 그 이미지만 빠진다). */
    readonly processing: boolean;
    readonly addFiles: (files: readonly File[]) => Promise<void>;
    readonly remove: (id: string) => void;
    /** 지금 첨부를 말풍선에 넘기고 비운다 — object URL은 말풍선이 이어 받아 여기서 놓지 않는다. */
    readonly takeAll: () => readonly ChatImageAttachment[];
}

function release(image: ChatImageAttachment): void {
    URL.revokeObjectURL(image.src);
}

/**
 * 입력창의 이미지 첨부 상태 — 선택·붙여넣기·끌어다 놓기가 모두 `addFiles`로 들어온다. 최대
 * {@link CHAT_IMAGES_PER_MESSAGE_MAX}장이고, 넘치는 파일과 못 읽는 파일은 그 파일만 거절하고 안내를 남긴다.
 * 보내지 않은 채 사라지면 object URL을 놓는다.
 */
export function useImageAttachments(): ImageAttachments {
    const [attachments, setAttachments] = useState<
        readonly ChatImageAttachment[]
    >([]);
    const [notice, setNotice] = useState<ImageNotice | null>(null);
    const [pendingCount, setPendingCount] = useState(0);
    // 이벤트 핸들러가 "지금" 값을 읽는다(상태는 렌더 뒤에야 바뀐다). ref는 상태를 바꾸는 바로 그 자리에서 함께
    // 바꾼다 — 효과로 뒤따라 맞추면 썸네일이 그려진 뒤 효과가 돌기 전에 누른 전송이 빈 목록을 가져가 이미지가
    // 조용히 빠진다.
    const attachmentsRef = useRef(attachments);
    const pendingRef = useRef(0);
    const commit = (next: readonly ChatImageAttachment[]): void => {
        attachmentsRef.current = next;
        setAttachments(next);
    };
    // 언마운트 뒤에 끝나는 `addFiles`가 새로 만든 URL을 붙들지 않도록 마운트 여부를 따로 든다.
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            // 언마운트 때만 — 보내지 않은 첨부의 URL을 놓는다.
            attachmentsRef.current.forEach(release);
        };
    }, []);

    const addFiles = async (files: readonly File[]): Promise<void> => {
        const room = Math.max(
            CHAT_IMAGES_PER_MESSAGE_MAX -
                attachmentsRef.current.length -
                pendingRef.current,
            0
        );
        const accepted = files.slice(0, room);
        const overflow = files.length > accepted.length;
        if (accepted.length === 0) {
            if (overflow) setNotice({ kind: 'limit' });
            return;
        }
        pendingRef.current += accepted.length;
        setPendingCount(pendingRef.current);
        const results = await Promise.all(accepted.map(prepareChatImage));
        pendingRef.current -= accepted.length;
        if (!mountedRef.current) {
            // 줄이는 동안 입력창이 사라졌다 — 상태에 넣어도 아무도 놓아 주지 않으므로 방금 만든 URL을 바로 놓는다.
            results.forEach(r => {
                if (r.ok) release(r.image);
            });
            return;
        }
        setPendingCount(pendingRef.current);
        const added = results.flatMap(r => (r.ok ? [r.image] : []));
        const failure = results
            .map((r, i) => ({ result: r, file: accepted[i] }))
            .find(({ result }) => !result.ok);
        commit([...attachmentsRef.current, ...added]);
        if (failure !== undefined && !failure.result.ok && failure.file)
            setNotice({
                kind: failure.result.reason,
                name: failure.file.name,
            });
        else setNotice(overflow ? { kind: 'limit' } : null);
    };

    const remove = (id: string): void => {
        const target = attachmentsRef.current.find(image => image.id === id);
        if (target) release(target);
        commit(attachmentsRef.current.filter(image => image.id !== id));
        setNotice(null);
    };

    const takeAll = (): readonly ChatImageAttachment[] => {
        const taken = attachmentsRef.current;
        commit([]);
        setNotice(null);
        return taken;
    };

    return {
        attachments,
        notice,
        processing: pendingCount > 0,
        addFiles,
        remove,
        takeAll,
    };
}
