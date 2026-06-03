// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { useNoticePopup } from '@/widgets/notice-popup/hooks/useNoticePopup';
import { getActiveNoticesAction } from '@/entities/notice/actions';
import { DISMISSED_NOTICES_STORAGE_KEY } from '@/entities/notice';
import type { NoticeRecord } from '@/entities/notice';

vi.mock('@/entities/notice/actions', () => ({
    getActiveNoticesAction: vi.fn(),
}));

const mockedAction = vi.mocked(getActiveNoticesAction);

function notice(overrides: Partial<NoticeRecord> = {}): NoticeRecord {
    return {
        id: 'n1',
        title: '점검 안내',
        body: '본문',
        linkUrl: null,
        linkLabel: null,
        pathPattern: null,
        createdAt: new Date(2026, 5, 3),
        ...overrides,
    };
}

describe('useNoticePopup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('공지를 fetch해서 pathname 매칭 큐를 구성한다', async () => {
        mockedAction.mockResolvedValue([notice()]);
        const { result } = renderHook(() => useNoticePopup('/'));
        await waitFor(() => expect(result.current.queue).toHaveLength(1));
        expect(result.current.queue[0].id).toBe('n1');
    });

    it('advance는 큐에서 첫 공지를 제거한다', async () => {
        mockedAction.mockResolvedValue([
            notice({ id: 'a', title: '첫 번째' }),
            notice({ id: 'b', title: '두 번째' }),
        ]);
        const { result } = renderHook(() => useNoticePopup('/'));
        await waitFor(() => expect(result.current.queue).toHaveLength(2));
        act(() => result.current.advance());
        expect(result.current.queue).toHaveLength(1);
        expect(result.current.queue[0].id).toBe('b');
    });

    it('dontShowAgain은 dismiss 저장 후 큐에서 제거한다', async () => {
        mockedAction.mockResolvedValue([notice({ id: 'dismiss-me' })]);
        const { result } = renderHook(() => useNoticePopup('/'));
        await waitFor(() => expect(result.current.queue).toHaveLength(1));
        act(() => result.current.dontShowAgain());
        expect(result.current.queue).toHaveLength(0);
        expect(
            JSON.parse(
                localStorage.getItem(DISMISSED_NOTICES_STORAGE_KEY) ?? '[]'
            )
        ).toEqual(['dismiss-me']);
    });

    it('dontShowAgain을 빈 큐에서 호출해도 예외가 없다(guard branch)', async () => {
        mockedAction.mockResolvedValue([]);
        const { result } = renderHook(() => useNoticePopup('/'));
        await waitFor(() => expect(result.current.queue).toHaveLength(0));
        expect(() => act(() => result.current.dontShowAgain())).not.toThrow();
        expect(localStorage.getItem(DISMISSED_NOTICES_STORAGE_KEY)).toBeNull();
    });

    it('pathname과 매칭되지 않는 공지는 큐에 포함하지 않는다', async () => {
        mockedAction.mockResolvedValue([notice({ pathPattern: '/market' })]);
        const { result } = renderHook(() => useNoticePopup('/'));
        await waitFor(() => expect(mockedAction).toHaveBeenCalledTimes(1));
        expect(result.current.queue).toHaveLength(0);
    });

    it('이미 dismiss된 공지는 큐에 포함하지 않는다', async () => {
        localStorage.setItem(
            DISMISSED_NOTICES_STORAGE_KEY,
            JSON.stringify(['n1'])
        );
        mockedAction.mockResolvedValue([notice({ id: 'n1' })]);
        const { result } = renderHook(() => useNoticePopup('/'));
        await waitFor(() => expect(mockedAction).toHaveBeenCalledTimes(1));
        expect(result.current.queue).toHaveLength(0);
    });
});
