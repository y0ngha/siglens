// @vitest-environment jsdom
/**
 * 마크다운 렌더러가 **정말로 지연 로드되는지** 고정한다.
 *
 * 이 팝업은 루트 레이아웃에서 항상 마운트되므로, 정적 import로 되돌아가면 공지가
 * 하나도 없는 페이지(=대부분의 페이지)까지 react-markdown 체인 청크 113KB를 받는다.
 * 이 브랜치가 홈에서 걷어낸 것이 정확히 그 청크다.
 *
 * 형제 파일 `FloatingChatButton.lazy.test.tsx`와 같은 이유로 **파일 하나에 테스트
 * 하나**다 — 모듈 레지스트리는 파일 단위로만 초기화되므로, 같은 파일에서 공지를
 * 한 번이라도 띄운 테스트가 앞서 돌면 이 단언이 무의미해진다.
 */
import { render, waitFor } from '@testing-library/react';

const loaded = vi.hoisted(() => ({ markdown: 0 }));

vi.mock('@/shared/ui/MarkdownText', () => {
    loaded.markdown += 1;
    return {
        MarkdownText: ({ children }: { children: React.ReactNode }) => (
            <div>{children}</div>
        ),
    };
});
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/entities/notice/actions', () => ({
    getActiveNoticesAction: vi.fn(),
}));

import { NoticePopup } from '@/widgets/notice-popup/ui/NoticePopup';
import { getActiveNoticesAction } from '@/entities/notice/actions';

it('띄울 공지가 없으면 마크다운 청크를 받지 않는다', async () => {
    vi.mocked(getActiveNoticesAction).mockResolvedValue([]);
    const { container } = render(<NoticePopup />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    // 정적 import로 되돌리면 모듈이 import 시점에 평가돼 1이 된다.
    expect(loaded.markdown).toBe(0);
});
