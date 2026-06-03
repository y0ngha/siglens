// @vitest-environment jsdom
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { NoticePopup } from '@/widgets/notice-popup/ui/NoticePopup';
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
        createdAt: new Date('2026-06-03T00:00:00+09:00'),
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
        await waitFor(() => expect(mockedAction).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
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
        await waitFor(() => expect(mockedAction).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });

    it('이미 dismiss된 공지는 표시하지 않는다', async () => {
        localStorage.setItem(
            DISMISSED_NOTICES_STORAGE_KEY,
            JSON.stringify(['n1'])
        );
        mockedAction.mockResolvedValue([notice({ id: 'n1' })]);
        const { container } = render(<NoticePopup />);
        await waitFor(() => expect(mockedAction).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
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
        await waitFor(() => expect(mockedAction).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });
});
