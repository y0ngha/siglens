import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { deleteConversationAction, renameConversationAction } = vi.hoisted(
    () => ({
        deleteConversationAction: vi.fn(),
        renameConversationAction: vi.fn(),
    })
);
vi.mock(
    '@/entities/chat-conversation/actions/deleteConversationAction',
    () => ({ deleteConversationAction })
);
vi.mock(
    '@/entities/chat-conversation/actions/renameConversationAction',
    () => ({ renameConversationAction })
);

import { useConversationMutations } from '@/widgets/agent-chat/hooks/useConversationMutations';

function setup() {
    const onRenamed = vi.fn();
    const onDeleted = vi.fn();
    const hook = renderHook(() =>
        useConversationMutations({ onRenamed, onDeleted })
    );
    return { ...hook, onRenamed, onDeleted };
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe('useConversationMutations', () => {
    beforeEach(() => {
        deleteConversationAction.mockReset();
        renameConversationAction.mockReset();
    });

    describe('rename', () => {
        it('shows the new title immediately, before the action settles', async () => {
            const d = deferred<{ ok: boolean }>();
            renameConversationAction.mockReturnValue(d.promise);
            const { result, onRenamed } = setup();

            let pending!: Promise<void>;
            act(() => {
                pending = result.current.rename('c1', 'old', 'new');
            });

            expect(onRenamed).toHaveBeenCalledTimes(1);
            expect(onRenamed).toHaveBeenCalledWith('c1', 'new');
            expect(renameConversationAction).toHaveBeenCalledWith('c1', 'new');
            await act(async () => {
                d.resolve({ ok: true });
                await pending;
            });
        });

        it('keeps the new title and no failure when the action succeeds', async () => {
            renameConversationAction.mockResolvedValue({ ok: true });
            const { result, onRenamed } = setup();

            await act(() => result.current.rename('c1', 'old', 'new'));

            expect(onRenamed).toHaveBeenCalledTimes(1);
            expect(result.current.failure).toBeNull();
        });

        it('rolls back to the previous title and reports failure when the action returns not ok', async () => {
            renameConversationAction.mockResolvedValue({ ok: false });
            const { result, onRenamed } = setup();

            await act(() => result.current.rename('c1', 'old', 'new'));

            expect(onRenamed).toHaveBeenNthCalledWith(1, 'c1', 'new');
            expect(onRenamed).toHaveBeenNthCalledWith(2, 'c1', 'old');
            expect(result.current.failure).toBe('rename');
        });

        it('rolls back and reports failure when the action throws', async () => {
            renameConversationAction.mockRejectedValue(new Error('network'));
            const { result, onRenamed } = setup();

            await act(() => result.current.rename('c1', 'old', 'new'));

            expect(onRenamed).toHaveBeenNthCalledWith(2, 'c1', 'old');
            expect(result.current.failure).toBe('rename');
        });

        it('does not clobber a newer rename when an earlier request fails', async () => {
            const first = deferred<{ ok: boolean }>();
            const second = deferred<{ ok: boolean }>();
            renameConversationAction
                .mockReturnValueOnce(first.promise)
                .mockReturnValueOnce(second.promise);
            const { result, onRenamed } = setup();

            let p1!: Promise<void>;
            let p2!: Promise<void>;
            act(() => {
                p1 = result.current.rename('c1', 'A', 'B');
            });
            act(() => {
                p2 = result.current.rename('c1', 'B', 'C');
            });
            await act(async () => {
                first.resolve({ ok: false });
                await p1;
            });

            expect(onRenamed).not.toHaveBeenCalledWith('c1', 'A');
            expect(result.current.failure).toBeNull();
            await act(async () => {
                second.resolve({ ok: true });
                await p2;
            });
        });

        it('rolls back the latest rename when it is the one that fails', async () => {
            const first = deferred<{ ok: boolean }>();
            const second = deferred<{ ok: boolean }>();
            renameConversationAction
                .mockReturnValueOnce(first.promise)
                .mockReturnValueOnce(second.promise);
            const { result, onRenamed } = setup();

            let p1!: Promise<void>;
            let p2!: Promise<void>;
            act(() => {
                p1 = result.current.rename('c1', 'A', 'B');
            });
            act(() => {
                p2 = result.current.rename('c1', 'B', 'C');
            });
            await act(async () => {
                second.resolve({ ok: false });
                await p2;
            });

            expect(onRenamed).toHaveBeenLastCalledWith('c1', 'B');
            expect(result.current.failure).toBe('rename');
            await act(async () => {
                first.resolve({ ok: true });
                await p1;
            });
        });

        it('tracks the latest title per conversation independently', async () => {
            const first = deferred<{ ok: boolean }>();
            renameConversationAction
                .mockReturnValueOnce(first.promise)
                .mockResolvedValueOnce({ ok: true });
            const { result, onRenamed } = setup();

            let p1!: Promise<void>;
            act(() => {
                p1 = result.current.rename('c1', 'A', 'B');
            });
            await act(() => result.current.rename('c2', 'X', 'Y'));
            await act(async () => {
                first.resolve({ ok: false });
                await p1;
            });

            expect(onRenamed).toHaveBeenLastCalledWith('c1', 'A');
        });

        it('clears a previous failure when a new rename starts', async () => {
            renameConversationAction.mockResolvedValueOnce({ ok: false });
            const { result } = setup();
            await act(() => result.current.rename('c1', 'old', 'new'));
            expect(result.current.failure).toBe('rename');

            renameConversationAction.mockResolvedValueOnce({ ok: true });
            await act(() => result.current.rename('c1', 'old', 'newer'));

            expect(result.current.failure).toBeNull();
        });
    });

    describe('remove', () => {
        it('removes from the list and returns true on success', async () => {
            deleteConversationAction.mockResolvedValue({ ok: true });
            const { result, onDeleted } = setup();

            let ok: boolean | undefined;
            await act(async () => {
                ok = await result.current.remove('c1');
            });

            expect(deleteConversationAction).toHaveBeenCalledWith('c1');
            expect(ok).toBe(true);
            expect(onDeleted).toHaveBeenCalledWith('c1');
            expect(result.current.failure).toBeNull();
        });

        it('keeps the row, returns false and reports failure when the action returns not ok', async () => {
            deleteConversationAction.mockResolvedValue({ ok: false });
            const { result, onDeleted } = setup();

            let ok: boolean | undefined;
            await act(async () => {
                ok = await result.current.remove('c1');
            });

            expect(ok).toBe(false);
            expect(onDeleted).not.toHaveBeenCalled();
            expect(result.current.failure).toBe('delete');
        });

        it('treats a thrown action as a failure', async () => {
            deleteConversationAction.mockRejectedValue(new Error('network'));
            const { result, onDeleted } = setup();

            let ok: boolean | undefined;
            await act(async () => {
                ok = await result.current.remove('c1');
            });

            expect(ok).toBe(false);
            expect(onDeleted).not.toHaveBeenCalled();
            expect(result.current.failure).toBe('delete');
        });

        it('clears a previous failure when a new delete starts', async () => {
            deleteConversationAction.mockResolvedValueOnce({ ok: false });
            const { result } = setup();
            await act(() => result.current.remove('c1'));
            expect(result.current.failure).toBe('delete');

            deleteConversationAction.mockResolvedValueOnce({ ok: true });
            await act(() => result.current.remove('c1'));

            expect(result.current.failure).toBeNull();
        });
    });
});
