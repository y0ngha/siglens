import { fireEvent, render, screen } from '@testing-library/react';
import { NoticeDialogHeader } from '../ui/dialog/NoticeDialogHeader';

describe('NoticeDialogHeader', () => {
    it('제목에 다이얼로그가 가리킬 id를 단다', () => {
        render(
            <NoticeDialogHeader
                titleId="title-id"
                title="서버 점검"
                onClose={vi.fn()}
            />
        );
        expect(
            screen.getByRole('heading', { level: 2, name: '서버 점검' })
        ).toHaveAttribute('id', 'title-id');
    });

    it('X 버튼은 이름이 있고 누르면 onClose를 부른다', () => {
        const onClose = vi.fn();
        render(
            <NoticeDialogHeader
                titleId="title-id"
                title="서버 점검"
                onClose={onClose}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: '팝업 닫기' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
