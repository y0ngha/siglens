const searchParams = { value: new URLSearchParams() };

vi.mock('next/navigation', () => ({
    useSearchParams: () => searchParams.value,
}));

vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        ...rest
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));

import { render, screen } from '@testing-library/react';
import { AuthCrossLink } from '../AuthCrossLink';

/**
 * 로그인 ↔ 회원가입 링크가 `next`를 잃으면, 인증 게이트에 걸려 돌아온
 * 사용자가 가입을 마친 뒤 원래 가려던 페이지 대신 기본 목적지로 떨어진다.
 * 잠금 해제 경로가 가입인 제품이라 특히 아프다.
 *
 * 이 링크는 `href="/signup"` 리터럴로 되돌려도 화면상 아무 차이가 없어
 * 조용히 회귀한다 — 그래서 여기서 붙든다.
 */
describe('AuthCrossLink', () => {
    beforeEach(() => {
        searchParams.value = new URLSearchParams();
    });

    it('next가 있으면 목적지에 이어 붙인다', () => {
        searchParams.value = new URLSearchParams('next=%2Fportfolio');
        render(<AuthCrossLink href="/signup">회원가입 →</AuthCrossLink>);
        expect(screen.getByText('회원가입 →')).toHaveAttribute(
            'href',
            '/signup?next=%2Fportfolio'
        );
    });

    it('next가 없으면 쿼리를 붙이지 않는다', () => {
        render(<AuthCrossLink href="/signup">회원가입 →</AuthCrossLink>);
        expect(screen.getByText('회원가입 →')).toHaveAttribute(
            'href',
            '/signup'
        );
    });

    /**
     * 이 값은 URL에서 오고 그대로 다음 화면의 폼으로 전달된다. 정제하지 않으면
     * 오픈 리디렉트 형태가 그대로 실려 나간다.
     */
    it.each(['//evil.com', '/\\evil.com', 'https://evil.com/x'])(
        '열린 리디렉트 형태(%s)는 실리지 않는다',
        raw => {
            searchParams.value = new URLSearchParams();
            searchParams.value.set('next', raw);
            render(<AuthCrossLink href="/signup">회원가입 →</AuthCrossLink>);
            expect(screen.getByText('회원가입 →')).toHaveAttribute(
                'href',
                '/signup'
            );
        }
    );
});
