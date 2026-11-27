import { render } from '@testing-library/react';
import { AuthFormSkeleton } from '../AuthFormSkeleton';

/**
 * 막대 개수는 `bg-secondary-700`으로 센다.
 *
 * 예전에는 `bg-secondary-800`이었는데, 이 팔레트에서 `secondary-800`은
 * **카드 표면 자체**(`SURFACE_CARD`)다. 인증 카드 안의 자리표시자가 카드와
 * 같은 색이라 대비 1.00:1로 아무것도 안 보였다 — 로그인·가입·비밀번호
 * 재설정의 로딩 화면이 통째로 빈 카드였다. 트리 전체의 자리표시자 85개가
 * 이미 `secondary-700`(카드 위 1.34:1)을 쓰고 있었고 여기가 관례를 벗어난
 * 쪽이었다.
 *
 * 셀렉터를 토큰 이름에 묶어 두는 이유: 토큰이 바뀌면 이 테스트가 0을
 * 반환하며 실패하므로, 자리표시자가 다시 보이지 않는 값으로 옮겨가면
 * 반드시 이 파일을 읽게 된다.
 */
describe('AuthFormSkeleton', () => {
    it('renders the default number of field rows (2) plus a button row', () => {
        const { container } = render(<AuthFormSkeleton />);
        const bars = container.querySelectorAll('div.bg-secondary-700');
        expect(bars.length).toBe(5);
    });

    it('renders the requested number of field rows', () => {
        const { container } = render(<AuthFormSkeleton rows={3} />);
        const bars = container.querySelectorAll('div.bg-secondary-700');
        expect(bars.length).toBe(7);
    });

    it('leadingAction은 실제 가입 블록의 행을 순서대로 그린다', () => {
        const { container } = render(
            <AuthFormSkeleton rows={1} leadingAction />
        );
        const root = container.firstElementChild as HTMLElement;
        const rows = Array.from(root.children);

        // 소셜 묶음(버튼 h-12 + 안내 h-4), 구분선 줄(h-4), 단계 안내(h-4), 입력 행(라벨 h-3), 제출 버튼(h-12)
        expect(rows).toHaveLength(5);
        expect(rows[0]?.firstElementChild).toHaveClass('h-12');
        expect(rows[1]).toHaveClass('h-4');
        expect(rows[2]).toHaveClass('h-4');
        expect(rows[3]?.firstElementChild).toHaveClass('h-3');
        expect(rows[4]).toHaveClass('h-12');
        const social = root.children[0] as HTMLElement;
        expect(social.children).toHaveLength(2);
        expect(social.children[1]).toHaveClass('mt-2', 'h-4');
        expect(root.children[1]).toHaveClass('my-6', 'h-4');
        // 막대: 버튼·안내·단계·입력 행(2)·제출 버튼
        expect(container.querySelectorAll('div.bg-secondary-700').length).toBe(
            6
        );
    });

    it('leadingAction을 주지 않으면 앞쪽 막대와 구분선이 없다', () => {
        const { container } = render(<AuthFormSkeleton rows={1} />);

        expect(container.querySelectorAll('div.h-12').length).toBe(0);
        expect(container.querySelectorAll('div.h-10').length).toBe(2);
    });

    it('자리표시자가 카드 표면 토큰을 쓰지 않는다', () => {
        // `secondary-800`은 카드 표면이라 그 위에 얹으면 1.00:1이 된다.
        const { container } = render(<AuthFormSkeleton rows={3} />);
        expect(
            container.querySelectorAll('[class*="bg-secondary-800"]').length
        ).toBe(0);
    });

    it('is hidden from assistive tech', () => {
        const { container } = render(<AuthFormSkeleton />);
        expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    });
});
