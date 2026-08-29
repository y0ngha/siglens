import { render, screen } from '@testing-library/react';
import { PasswordStrengthHint } from '@/shared/ui/auth/PasswordStrengthHint';

describe('PasswordStrengthHint', () => {
    it('renders all three rules', () => {
        render(<PasswordStrengthHint password="" />);
        expect(screen.getByText(/자 이상/)).toBeInTheDocument();
        expect(screen.getByText('영어 포함')).toBeInTheDocument();
        expect(screen.getByText('숫자 포함')).toBeInTheDocument();
    });

    it('marks length rule as passing when password is long enough', () => {
        const { container } = render(
            <PasswordStrengthHint password="abcdefgh1" />
        );
        const items = container.querySelectorAll('li');
        // First item is the length rule
        expect(items[0]).toHaveTextContent('✓');
    });

    it('marks letter rule as passing when password has a letter', () => {
        const { container } = render(<PasswordStrengthHint password="a" />);
        const items = container.querySelectorAll('li');
        // Second item is the letter rule
        expect(items[1]).toHaveTextContent('✓');
    });

    it('marks number rule as passing when password has a digit', () => {
        const { container } = render(<PasswordStrengthHint password="1" />);
        const items = container.querySelectorAll('li');
        // Third item is the number rule
        expect(items[2]).toHaveTextContent('✓');
    });

    it('shows all rules as not passing for empty password', () => {
        const { container } = render(<PasswordStrengthHint password="" />);
        const items = container.querySelectorAll('li');
        for (const item of items) {
            expect(item).toHaveTextContent('○');
        }
    });

    it('shows all rules as passing for a strong password', () => {
        const { container } = render(
            <PasswordStrengthHint password="abc12345" />
        );
        const items = container.querySelectorAll('li');
        for (const item of items) {
            expect(item).toHaveTextContent('✓');
        }
    });

    it('sets id from descriptionId prop', () => {
        const { container } = render(
            <PasswordStrengthHint password="" descriptionId="pw-hint" />
        );
        expect(container.querySelector('#pw-hint')).toBeInTheDocument();
    });
});

/**
 * 보조기술용 상태 텍스트. ✓/○ 글리프는 `aria-hidden`이고 라벨 문자열은 두
 * 상태가 동일하므로, 이 sr-only 텍스트가 없으면 스크린리더 사용자는 어떤
 * 규칙이 모자란지 알 수 없다. 기존 7개 케이스가 전부 글리프만 단언해서
 * 이 텍스트를 지워도 스위트가 초록이었다.
 */
describe('sr-only 상태 텍스트', () => {
    // `충족`은 `미충족`의 부분 문자열이라 앵커가 없으면 둘이 섞인다.
    // 테스팅 라이브러리가 공백을 정규화하므로 앞 공백은 매처에 넣지 않는다.
    it('빈 비밀번호에서는 세 규칙 모두 미충족으로 노출된다', () => {
        render(<PasswordStrengthHint password="" />);
        expect(screen.getAllByText(/미충족/)).toHaveLength(3);
        expect(screen.queryAllByText(/^충족$/)).toHaveLength(0);
    });

    it('규칙을 모두 만족하면 세 규칙 모두 충족으로 노출된다', () => {
        render(<PasswordStrengthHint password="abcd1234" />);
        expect(screen.getAllByText(/^충족$/)).toHaveLength(3);
        expect(screen.queryAllByText(/미충족/)).toHaveLength(0);
    });

    it('부분 충족은 규칙별로 갈린다', () => {
        // 8자 미만 + 영문 + 숫자 → 길이만 미충족.
        render(<PasswordStrengthHint password="ab12" />);
        expect(screen.getAllByText(/^충족$/)).toHaveLength(2);
        expect(screen.getAllByText(/미충족/)).toHaveLength(1);
    });
});
