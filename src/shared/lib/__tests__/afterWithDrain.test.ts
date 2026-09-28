const { mockAfter, mockFireAndForget } = vi.hoisted(() => ({
    mockAfter: vi.fn(),
    mockFireAndForget: vi.fn(),
}));

vi.mock('next/server', () => ({ after: mockAfter }));
vi.mock('@/shared/lib/backgroundTask', () => ({
    fireAndForget: mockFireAndForget,
}));

import { afterWithDrain } from '@/shared/lib/afterWithDrain';

function runAfterCallback(): Promise<void> {
    const callback = mockAfter.mock.calls[0]?.[0] as () => Promise<void>;
    return callback();
}

function drainPromise(): Promise<void> {
    return mockFireAndForget.mock.calls[0]?.[0] as Promise<void>;
}

describe('afterWithDrain', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('task를 즉시 실행하지 않고 after()로 미루며, drain 대상을 먼저 등록한다', () => {
        const task = vi.fn().mockResolvedValue(undefined);
        afterWithDrain(task);
        expect(task).not.toHaveBeenCalled();
        expect(mockFireAndForget).toHaveBeenCalledOnce();
        expect(mockAfter).toHaveBeenCalledOnce();
    });

    it('task가 끝나면 drain promise가 settle된다', async () => {
        const task = vi.fn().mockResolvedValue(undefined);
        afterWithDrain(task);
        await runAfterCallback();
        expect(task).toHaveBeenCalledOnce();
        await expect(drainPromise()).resolves.toBeUndefined();
    });

    it('task가 던져도 drain promise는 settle된다 (drain이 매달리지 않는다)', async () => {
        const task = vi.fn().mockRejectedValue(new Error('boom'));
        afterWithDrain(task);
        await expect(runAfterCallback()).rejects.toThrow('boom');
        await expect(drainPromise()).resolves.toBeUndefined();
    });
});
