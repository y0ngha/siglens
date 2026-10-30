import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ConversationListItem } from '@/entities/chat-conversation/actions/listConversationsAction';
import { useConversationList } from '@/widgets/agent-chat/hooks/useConversationList';

const initial: ConversationListItem[] = [
    { id: 'a', title: 'A', lastMessageAt: '2026-10-01T00:00:00.000Z' },
    { id: 'b', title: 'B', lastMessageAt: '2026-09-01T00:00:00.000Z' },
];

describe('useConversationList', () => {
    describe('초기 상태', () => {
        it('서버가 준 목록을 그대로 쓴다', () => {
            const { result } = renderHook(() => useConversationList(initial));
            expect(result.current.items).toEqual(initial);
        });

        it('새 prop이 와도 로컬 상태를 덮지 않는다', () => {
            const { result, rerender } = renderHook(
                ({ list }) => useConversationList(list),
                { initialProps: { list: initial } }
            );
            act(() => result.current.remove('a'));
            rerender({ list: initial });
            expect(result.current.items.map(i => i.id)).toEqual(['b']);
        });
    });

    describe('addCreated', () => {
        it('새 대화를 맨 위에 올린다', () => {
            const { result } = renderHook(() => useConversationList(initial));
            act(() => result.current.addCreated('c', 'C'));
            expect(result.current.items.map(i => i.id)).toEqual([
                'c',
                'a',
                'b',
            ]);
            expect(result.current.items[0].title).toBe('C');
        });

        it('같은 id가 있으면 중복 없이 맨 위로 옮긴다', () => {
            const { result } = renderHook(() => useConversationList(initial));
            act(() => result.current.addCreated('b', 'B2'));
            expect(result.current.items.map(i => i.id)).toEqual(['b', 'a']);
            expect(result.current.items[0].title).toBe('B2');
        });
    });

    describe('rename', () => {
        it('그 대화의 제목만 바꾸고 순서는 그대로다', () => {
            const { result } = renderHook(() => useConversationList(initial));
            act(() => result.current.rename('b', 'renamed'));
            expect(result.current.items).toEqual([
                initial[0],
                { ...initial[1], title: 'renamed' },
            ]);
        });
    });

    describe('remove', () => {
        it('그 대화를 목록에서 뺀다', () => {
            const { result } = renderHook(() => useConversationList(initial));
            act(() => result.current.remove('a'));
            expect(result.current.items).toEqual([initial[1]]);
        });

        it('없는 id는 목록을 바꾸지 않는다', () => {
            const { result } = renderHook(() => useConversationList(initial));
            act(() => result.current.remove('zzz'));
            expect(result.current.items).toEqual(initial);
        });
    });
});
