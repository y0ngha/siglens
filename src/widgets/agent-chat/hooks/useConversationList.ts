'use client';

/**
 * 레일 대화 목록 클라이언트 상태 훅 — 서버가 준 목록을 초기값으로 받고, 새로 만든 대화·이름
 * 바꾸기·삭제는 로컬에서 반영한다.
 */
import { useState } from 'react';
import type { ConversationListItem } from '@/entities/chat-conversation/model';

interface UseConversationListReturn {
    items: ConversationListItem[];
    /** 방금 만든 대화를 맨 위에 올린다(같은 id가 있으면 그 자리를 대신한다). */
    addCreated: (id: string, title: string) => void;
    rename: (id: string, title: string) => void;
    remove: (id: string) => void;
}

/**
 * `router.refresh()`로 다시 읽지 않는다 — 첫 전송의 `replaceState`가 URL을 다른 라우트
 * 세그먼트(`/c/<id>`)로 옮기므로, refresh하면 Next가 `/c/[id]` 트리로 갈아 끼우며 이미 보이는
 * 대화 위로 `loading.tsx` 골격을 띄우고, 스트리밍 중이면 셸을 언마운트해 턴을 끊는다. 목록에
 * 필요한 변경은 모두 여기서 알 수 있다(만든 대화는 스트림이, 이름 바꾸기·삭제는 레일이 알린다).
 */
export function useConversationList(
    initial: ConversationListItem[]
): UseConversationListReturn {
    // 서버 목록은 초기값일 뿐이다 — 새 prop으로 덮으면 refresh 없이 반영한 낙관 상태를 잃는다.
    // react-doctor-disable-next-line react-doctor/no-derived-useState
    const [items, setItems] = useState(initial);
    return {
        items,
        addCreated: (id, title) =>
            setItems(prev => [
                { id, title, lastMessageAt: new Date().toISOString() },
                ...prev.filter(item => item.id !== id),
            ]),
        rename: (id, title) =>
            setItems(prev =>
                prev.map(item => (item.id === id ? { ...item, title } : item))
            ),
        remove: id => setItems(prev => prev.filter(item => item.id !== id)),
    };
}
