import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PreviewHeadlineList } from '../../ui/card/PreviewHeadlineList';

describe('PreviewHeadlineList', () => {
    it('헤드라인을 카드 제목이 붙은 목록으로 렌더한다', () => {
        render(
            <PreviewHeadlineList
                label="미국 주식"
                headlines={['애플 실적 발표', '엔비디아 신고가']}
            />
        );
        const list = screen.getByRole('list', { name: '미국 주식 미리보기' });
        expect(
            [...list.querySelectorAll('li')].map(li => li.textContent)
        ).toEqual(['애플 실적 발표', '엔비디아 신고가']);
    });

    it('헤드라인이 없으면 목록 대신 대체 문구를 렌더한다', () => {
        render(<PreviewHeadlineList label="미국 주식" headlines={[]} />);
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
        expect(
            screen.getByText('최신 뉴스를 불러오고 있어요.')
        ).toBeInTheDocument();
    });

    /**
     * 빈 제목·중복 제목이 그대로 들어오면 빈 `<li>`가 읽히고 같은 key가 겹쳐 React가
     * 경고한다. 걸러낸 뒤 남는 것만 렌더한다.
     */
    it('빈 헤드라인과 중복 헤드라인은 한 줄도 렌더하지 않는다', () => {
        render(
            <PreviewHeadlineList
                label="미국 외환"
                headlines={['', '달러 강세', '달러 강세']}
            />
        );
        expect(
            screen.getAllByRole('listitem').map(li => li.textContent)
        ).toEqual(['달러 강세']);
    });

    it('걸러낸 뒤 남는 헤드라인이 없으면 대체 문구로 넘어간다', () => {
        render(<PreviewHeadlineList label="미국 외환" headlines={['', ' ']} />);
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
        expect(
            screen.getByText('최신 뉴스를 불러오고 있어요.')
        ).toBeInTheDocument();
    });
});
