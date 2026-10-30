'use client';

/**
 * 대화 이름 바꾸기·삭제 서버 액션을 부르는 훅 — 낙관적 갱신, 실패 시 되돌리기, 실패 알림을 맡는다.
 */
import { useRef, useState } from 'react';
import { deleteConversationAction } from '@/entities/chat-conversation/actions/deleteConversationAction';
import { renameConversationAction } from '@/entities/chat-conversation/actions/renameConversationAction';

/** 마지막으로 실패한 작업 — 레일이 짧은 안내를 띄운다. */
export type ConversationMutationFailure = 'rename' | 'delete' | null;

interface UseConversationMutationsInput {
    /** 부모가 가진 목록에 제목을 반영한다(되돌리기에도 쓴다). */
    onRenamed: (id: string, title: string) => void;
    /** 부모가 가진 목록에서 지운다. */
    onDeleted: (id: string) => void;
}

interface UseConversationMutationsReturn {
    /** 새 제목을 바로 보이고 저장한다. 실패하면 이전 제목으로 되돌린다. */
    rename: (
        id: string,
        previousTitle: string,
        nextTitle: string
    ) => Promise<void>;
    /** 서버에서 지우고 성공하면 목록에서도 뺀다. 성공 여부를 돌려준다. */
    remove: (id: string) => Promise<boolean>;
    failure: ConversationMutationFailure;
}

/** 액션 결과를 성공 여부로 접는다 — 네트워크 예외도 실패로 본다(거부를 흘리지 않는다). */
function settled(action: Promise<{ ok: boolean }>): Promise<boolean> {
    return action.then(
        ({ ok }) => ok,
        () => false
    );
}

/**
 * 되돌리기는 **그 요청이 아직 마지막 요청일 때만** 한다 — A→B 요청이 진행 중에 B→C를 보냈는데
 * 첫 요청이 실패하면, 제출 당시 제목(A)으로 돌리면 더 새로운 C를 덮는다.
 */
export function useConversationMutations({
    onRenamed,
    onDeleted,
}: UseConversationMutationsInput): UseConversationMutationsReturn {
    const [failure, setFailure] = useState<ConversationMutationFailure>(null);
    // 대화별 마지막으로 요청한 제목 — 응답 처리 중에만 읽는 명령형 캐시라 ref로 둔다.
    const latestTitleRef = useRef(new Map<string, string>());

    const rename = async (
        id: string,
        previousTitle: string,
        nextTitle: string
    ): Promise<void> => {
        setFailure(null);
        latestTitleRef.current.set(id, nextTitle);
        onRenamed(id, nextTitle);
        const ok = await settled(renameConversationAction(id, nextTitle));
        // 더 새로운 요청이 있으면 그 요청이 정리한다.
        if (latestTitleRef.current.get(id) !== nextTitle) return;
        latestTitleRef.current.delete(id);
        if (ok) return;
        onRenamed(id, previousTitle);
        setFailure('rename');
    };

    const remove = async (id: string): Promise<boolean> => {
        setFailure(null);
        const ok = await settled(deleteConversationAction(id));
        if (!ok) {
            setFailure('delete');
            return false;
        }
        onDeleted(id);
        return true;
    };

    return { rename, remove, failure };
}
