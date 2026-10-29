import { render, screen } from '@testing-library/react';
import { GuidePageHeader } from '../GuidePageHeader';

describe('GuidePageHeader', () => {
    it('제목을 h1로, 소개를 그 아래 단락으로 그린다', () => {
        render(<GuidePageHeader title="차트 가이드" intro="소개 단락" />);

        expect(
            screen.getByRole('heading', { level: 1, name: '차트 가이드' })
        ).toBeInTheDocument();
        expect(screen.getByText('소개 단락').tagName).toBe('P');
        expect(screen.getByRole('banner')).toHaveClass('pb-8');
    });

    it('소개가 없으면 단락도 아래 여백도 두지 않는다', () => {
        const { container } = render(<GuidePageHeader title="차트 가이드" />);

        const header = container.querySelector('header');
        expect(header?.querySelectorAll('p')).toHaveLength(1);
        expect(header).not.toHaveClass('pb-8');
    });
});
