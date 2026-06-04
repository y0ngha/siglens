// @vitest-environment jsdom
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { NoticePopup } from '@/widgets/notice-popup/ui/NoticePopup';
import { getActiveNoticesAction } from '@/entities/notice/actions';
import type { NoticeRecord } from '@/entities/notice';
import { DISMISSED_NOTICES_STORAGE_KEY } from '../utils/noticeStorage';

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

    it('푸터 버튼은 스크롤 본문(overflow-y-auto) 밖에 위치한다 — 긴 본문에도 버튼 고정', async () => {
        mockedAction.mockResolvedValue([notice()]);
        const { container } = render(<NoticePopup />);
        await screen.findByText('긴급 점검 안내');
        const scroller = container.querySelector('.overflow-y-auto');
        expect(scroller).not.toBeNull();
        // 푸터가 스크롤 영역의 자손이 되면(=footer가 스크롤 안으로 들어가면) 긴 본문에서
        // 버튼이 화면 밖으로 밀리는 원래 버그가 재발한다. 항상 스크롤 밖(sibling)이어야 한다.
        // (overflow의 실제 동작/높이는 jsdom이 측정 못 하므로 Playwright로 검증 — 여기서는
        //  회귀를 잡는 구조 불변식만 단언한다.)
        expect(
            scroller?.contains(
                screen.getByRole('button', { name: '다시 보지 않기' })
            )
        ).toBe(false);
        expect(
            scroller?.contains(screen.getByRole('button', { name: '닫기' }))
        ).toBe(false);
        // 모달 content는 뷰포트 초과를 막는 max-h 제약을 가진다.
        expect(screen.getByRole('dialog').className).toContain('max-h-');
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
