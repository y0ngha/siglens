import { render, screen, within } from '@testing-library/react';
import { SignupBenefits } from '@/features/auth-signup/ui/SignupBenefits';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';

describe('SignupBenefits', () => {
    it('제목과 네 항목을 목록으로 그린다', () => {
        render(<SignupBenefits />);

        expect(
            screen.getByRole('heading', { level: 2, name: '회원 혜택' })
        ).toBeInTheDocument();
        expect(screen.getAllByRole('listitem')).toHaveLength(4);
    });

    it('시간 프레임 범위·상세 분석 이름·모델 수를 등급 설정에서 가져와 적는다', () => {
        render(<SignupBenefits />);
        const items = within(screen.getByRole('list'))
            .getAllByRole('listitem')
            .map(item => item.textContent);

        expect(items[0]).toContain('5분부터 4시간까지');
        expect(items[1]).toContain("'상세 분석'을");
        expect(items[2]).toContain('AI 모델 5개');
        expect(items[3]).toContain('보유종목과 관심종목');
    });

    it('진입·손절·목표가·무제한 같은 단정적 표현을 쓰지 않는다', () => {
        const { container } = render(<SignupBenefits />);

        ['진입', '손절', '목표가', '무제한'].forEach(word => {
            expect(container.textContent).not.toContain(word);
        });
    });

    it('항목 문구는 좁은 화면에서 넘치지 않게 wrap-anywhere를 가진다', () => {
        render(<SignupBenefits />);

        screen.getAllByRole('listitem').forEach(item => {
            expect(item.querySelector('span')).toHaveClass('wrap-anywhere');
        });
    });

    it('목록은 제목에 연결된 영역이다', () => {
        render(<SignupBenefits />);

        expect(
            screen.getByRole('region', { name: '회원 혜택' })
        ).toBeInTheDocument();
    });

    it('영어 로케일은 영어 카탈로그와 로케일별 시간 프레임 표기를 쓴다', () => {
        renderWithIntl(<SignupBenefits />, { locale: 'en' });

        expect(
            screen.getByRole('heading', { name: 'Member benefits' })
        ).toBeInTheDocument();
        const items = screen
            .getAllByRole('listitem')
            .map(item => item.textContent ?? '');
        expect(items[0]).toMatch(/from 5 min to 4 hr/);
        expect(items[1]).toContain("'Detailed analysis'");
        expect(items[2]).toContain('Choose from 5 more AI models');
    });
});
