import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import type { ChatImageAttachment } from '@/features/agent-chat/model/types';
import { UserMessage } from '@/widgets/agent-chat/message/UserMessage';
import ko from '../../../../../messages/ko.json';

const live: ChatImageAttachment = {
    id: 'a',
    src: 'blob:live-1',
    width: 40,
    height: 30,
    payload: { mediaType: 'image/jpeg', data: 'AAAA' },
};
const stored: ChatImageAttachment = {
    id: 'img-9',
    src: '/api/ai/chat/images/img-9',
    width: 20,
    height: 20,
};

const renderMessage = (
    over: Partial<React.ComponentProps<typeof UserMessage>> = {}
) =>
    render(
        <NextIntlClientProvider locale="ko" messages={ko}>
            <UserMessage
                content="이거 어때?"
                nodeRef={() => {}}
                minHeight={undefined}
                actions={null}
                {...over}
            />
        </NextIntlClientProvider>
    );

describe('UserMessage — 이미지', () => {
    it('방금 보낸 이미지는 object URL, 저장된 이미지는 조회 경로로 그린다', () => {
        renderMessage({ images: [live, stored] });
        expect(screen.getByAltText('첨부 이미지 1')).toHaveAttribute(
            'src',
            'blob:live-1'
        );
        expect(screen.getByAltText('첨부 이미지 2')).toHaveAttribute(
            'src',
            '/api/ai/chat/images/img-9'
        );
    });

    it('썸네일을 누르면 새 탭에서 원본을 열도록 링크가 걸려 있다', () => {
        renderMessage({ images: [stored] });
        const link = screen.getByRole('link', {
            name: '첨부 이미지 1 새 탭에서 열기',
        });
        expect(link).toHaveAttribute('href', '/api/ai/chat/images/img-9');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link.getAttribute('rel')).toContain('noopener');
    });

    it('썸네일 상자 크기가 고정이고 목록에 접근성 이름이 있다', () => {
        renderMessage({ images: [live] });
        const list = screen.getByRole('list', { name: '첨부한 이미지' });
        const img = within(list).getByRole('img');
        expect(img.className).toMatch(/\bsize-24\b/);
        expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    });

    it('글 없이 이미지만 보낸 질문은 빈 말풍선을 그리지 않는다', () => {
        const { container } = renderMessage({ content: '', images: [live] });
        expect(container.querySelector('.surface-raised')).toBeNull();
        expect(screen.getByAltText('첨부 이미지 1')).toBeInTheDocument();
    });

    it('이미지가 없으면 목록을 그리지 않고 글 말풍선만 그린다', () => {
        renderMessage();
        expect(screen.queryByRole('list')).toBeNull();
        expect(screen.getByText('이거 어때?')).toBeInTheDocument();
    });
});
