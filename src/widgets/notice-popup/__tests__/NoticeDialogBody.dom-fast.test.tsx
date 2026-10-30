import { render, screen } from '@testing-library/react';
import type { NoticeDialogBodyProps } from '../ui/dialog/NoticeDialogBody';
import { NoticeDialogBody } from '../ui/dialog/NoticeDialogBody';
import { MODULE_LOAD_TIMEOUT_MS } from '@/shared/test-utils/testTimeouts';

type BodyNotice = NoticeDialogBodyProps['notice'];

function bodyNotice(overrides: Partial<BodyNotice> = {}): BodyNotice {
    return {
        body: '**굵은 안내** 입니다.',
        createdAt: new Date(2026, 2, 9),
        linkUrl: null,
        linkLabel: null,
        ...overrides,
    };
}

describe('NoticeDialogBody', () => {
    // 마크다운 렌더러는 지연 청크다 — 첫 적재 비용을 단언 본문의 기본 타임아웃에서 뺀다.
    beforeAll(async () => {
        await import('@/shared/ui/MarkdownText');
    }, MODULE_LOAD_TIMEOUT_MS);

    it('작성일과 마크다운 본문을 키보드로 스크롤 가능한 영역에 그린다', async () => {
        render(<NoticeDialogBody notice={bodyNotice()} />);
        const region = screen.getByRole('region', { name: '공지 본문' });
        expect(region).toHaveAttribute('tabindex', '0');
        expect(screen.getByText('2026.03.09 작성')).toBeInTheDocument();
        expect(await screen.findByText('굵은 안내')).toBeInTheDocument();
    });

    it('URL이 없으면 링크를 그리지 않는다', async () => {
        render(<NoticeDialogBody notice={bodyNotice()} />);
        await screen.findByText('굵은 안내');
        expect(screen.queryByRole('link')).toBeNull();
    });

    it('라벨이 있으면 라벨로 새 탭 링크를 그린다', async () => {
        render(
            <NoticeDialogBody
                notice={bodyNotice({
                    linkUrl: 'https://siglens.io/guide',
                    linkLabel: '가이드 보기',
                })}
            />
        );
        const link = await screen.findByRole('link', { name: '가이드 보기' });
        expect(link).toHaveAttribute('href', 'https://siglens.io/guide');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('라벨이 빈 문자열이면 URL을 링크 이름으로 쓴다', async () => {
        render(
            <NoticeDialogBody
                notice={bodyNotice({
                    linkUrl: 'https://siglens.io/blank',
                    linkLabel: '',
                })}
            />
        );
        expect(
            await screen.findByRole('link', {
                name: 'https://siglens.io/blank',
            })
        ).toBeInTheDocument();
    });

    it('http(s)가 아닌 URL은 링크를 그리지 않는다', async () => {
        render(
            <NoticeDialogBody
                notice={bodyNotice({
                    linkUrl: 'javascript:alert(1)',
                    linkLabel: '클릭',
                })}
            />
        );
        await screen.findByText('굵은 안내');
        expect(screen.queryByRole('link')).toBeNull();
    });
});
