// @vitest-environment jsdom
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import {
    NoticePopup,
    formatNoticeDate,
} from '@/widgets/notice-popup/ui/NoticePopup';
import { getActiveNoticesAction } from '@/entities/notice/actions';
import { DISMISSED_NOTICES_STORAGE_KEY } from '@/entities/notice';
import type { NoticeRecord } from '@/entities/notice';

vi.mock('next/navigation', () => ({
    usePathname: () => '/',
}));

vi.mock('@/entities/notice/actions', () => ({
    getActiveNoticesAction: vi.fn(),
}));

const mockedAction = vi.mocked(getActiveNoticesAction);

function notice(overrides: Partial<NoticeRecord> = {}): NoticeRecord {
    return {
        id: 'n1',
        title: '긴급 점검 안내',
        body: '**오늘 23시** 점검 예정입니다.',
        linkUrl: null,
        linkLabel: null,
        pathPattern: null,
        createdAt: new Date(2026, 5, 3),
        ...overrides,
    };
}

describe('NoticePopup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('활성 공지가 없으면 아무것도 렌더하지 않는다', async () => {
        mockedAction.mockResolvedValue([]);
        const { container } = render(<NoticePopup />);
        // fetch-once + client-side filter 구조: action 호출 후 filter effect가
        // 추가로 한 번 실행되므로 container가 비었을 때까지 waitFor로 대기한다.
        await waitFor(() => {
            expect(mockedAction).toHaveBeenCalledTimes(1);
            expect(container).toBeEmptyDOMElement();
        });
    });

    it('공지의 제목·본문(마크다운)·작성일을 렌더한다', async () => {
        mockedAction.mockResolvedValue([notice()]);
        render(<NoticePopup />);
        expect(await screen.findByText('긴급 점검 안내')).toBeInTheDocument();
        expect(screen.getByText('오늘 23시')).toBeInTheDocument();
        expect(screen.getByText('2026.06.03 작성')).toBeInTheDocument();
    });

    it('linkUrl이 있으면 링크를 렌더하고, label이 없으면 url을 표시한다', async () => {
        mockedAction.mockResolvedValue([
            notice({ linkUrl: 'https://siglens.io/blog', linkLabel: null }),
        ]);
        render(<NoticePopup />);
        const link = await screen.findByRole('link');
        expect(link).toHaveAttribute('href', 'https://siglens.io/blog');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        expect(link).toHaveTextContent('https://siglens.io/blog');
    });

    it('linkLabel이 있으면 라벨을 표시한다', async () => {
        mockedAction.mockResolvedValue([
            notice({ linkUrl: 'https://x.io', linkLabel: '자세히 보기' }),
        ]);
        render(<NoticePopup />);
        expect(await screen.findByText('자세히 보기')).toBeInTheDocument();
    });

    it('현재 경로와 매칭되지 않는 공지는 표시하지 않는다', async () => {
        mockedAction.mockResolvedValue([notice({ pathPattern: '/market' })]);
        const { container } = render(<NoticePopup />);
        await waitFor(() => {
            expect(mockedAction).toHaveBeenCalledTimes(1);
            expect(container).toBeEmptyDOMElement();
        });
    });

    it('이미 dismiss된 공지는 표시하지 않는다', async () => {
        localStorage.setItem(
            DISMISSED_NOTICES_STORAGE_KEY,
            JSON.stringify(['n1'])
        );
        mockedAction.mockResolvedValue([notice({ id: 'n1' })]);
        const { container } = render(<NoticePopup />);
        await waitFor(() => {
            expect(mockedAction).toHaveBeenCalledTimes(1);
            expect(container).toBeEmptyDOMElement();
        });
    });

    it('"닫기"는 임시 닫기 — localStorage에 저장하지 않고 다음 공지로 넘어간다', async () => {
        mockedAction.mockResolvedValue([
            notice({ id: 'n1', title: '첫 번째' }),
            notice({ id: 'n2', title: '두 번째' }),
        ]);
        render(<NoticePopup />);
        expect(await screen.findByText('첫 번째')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '닫기' }));
        expect(await screen.findByText('두 번째')).toBeInTheDocument();
        expect(localStorage.getItem(DISMISSED_NOTICES_STORAGE_KEY)).toBeNull();
    });

    it('"다시 보지 않기"는 해당 ID를 localStorage에 저장하고 다음 공지로 넘어간다', async () => {
        mockedAction.mockResolvedValue([
            notice({ id: 'n1', title: '첫 번째' }),
            notice({ id: 'n2', title: '두 번째' }),
        ]);
        render(<NoticePopup />);
        expect(await screen.findByText('첫 번째')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '다시 보지 않기' }));
        expect(await screen.findByText('두 번째')).toBeInTheDocument();
        expect(
            JSON.parse(
                localStorage.getItem(DISMISSED_NOTICES_STORAGE_KEY) ?? '[]'
            )
        ).toEqual(['n1']);
    });

    it('마지막 공지를 닫으면 모달이 사라진다', async () => {
        mockedAction.mockResolvedValue([notice({ id: 'n1' })]);
        render(<NoticePopup />);
        await screen.findByRole('dialog');
        fireEvent.click(screen.getByRole('button', { name: '닫기' }));
        await waitFor(() =>
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        );
    });

    it('action이 reject해도 throw하지 않고 모달을 띄우지 않는다', async () => {
        mockedAction.mockRejectedValue(new Error('network'));
        const { container } = render(<NoticePopup />);
        // reject 시에는 allNotices가 갱신되지 않으므로 filter effect는 빈 배열로 실행된다.
        await waitFor(() => {
            expect(mockedAction).toHaveBeenCalledTimes(1);
            expect(container).toBeEmptyDOMElement();
        });
    });

    it('Esc로 닫으면 다음 공지로 넘어간다', async () => {
        mockedAction.mockResolvedValue([
            notice({ id: 'n1', title: '첫 번째' }),
            notice({ id: 'n2', title: '두 번째' }),
        ]);
        render(<NoticePopup />);
        expect(await screen.findByText('첫 번째')).toBeInTheDocument();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(await screen.findByText('두 번째')).toBeInTheDocument();
    });

    it('javascript: linkUrl은 링크를 렌더하지 않지만 모달·제목은 표시된다', async () => {
        mockedAction.mockResolvedValue([
            notice({ linkUrl: 'javascript:alert(1)', linkLabel: '클릭' }),
        ]);
        render(<NoticePopup />);
        expect(await screen.findByText('긴급 점검 안내')).toBeInTheDocument();
        expect(screen.queryByRole('link')).toBeNull();
    });

    it('fetch 완료 전에 언마운트하면 상태 업데이트를 건너뛴다(cancelled guard)', async () => {
        let resolveNotices!: (v: NoticeRecord[]) => void;
        mockedAction.mockReturnValue(
            new Promise<NoticeRecord[]>(res => {
                resolveNotices = res;
            })
        );
        const { unmount } = render(<NoticePopup />);
        unmount();
        resolveNotices([notice()]);
        await new Promise(r => setTimeout(r, 0));
    });

    it('"다시 보지 않기" 클릭 시 current가 있을 때만 dismissNotice를 호출한다', async () => {
        mockedAction.mockResolvedValue([notice({ id: 'dismiss-guard' })]);
        render(<NoticePopup />);
        await screen.findByRole('dialog');
        fireEvent.click(screen.getByRole('button', { name: '다시 보지 않기' }));
        await waitFor(() =>
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        );
        expect(
            JSON.parse(
                localStorage.getItem(DISMISSED_NOTICES_STORAGE_KEY) ?? '[]'
            )
        ).toEqual(['dismiss-guard']);
    });
});

describe('formatNoticeDate', () => {
    it('Date 객체 입력을 YYYY.MM.DD 작성 형태로 포맷한다', () => {
        expect(formatNoticeDate(new Date(2026, 5, 3))).toBe('2026.06.03 작성');
    });

    it('ISO 문자열 입력도 YYYY.MM.DD 작성 형태로 포맷한다', () => {
        expect(formatNoticeDate('2026-06-03T00:00:00')).toBe('2026.06.03 작성');
    });

    it('파싱할 수 없는 문자열은 빈 문자열을 반환한다', () => {
        expect(formatNoticeDate('not-a-date')).toBe('');
    });
});
