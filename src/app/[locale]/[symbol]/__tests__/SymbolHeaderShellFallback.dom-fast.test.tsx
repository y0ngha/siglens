import { render, screen } from '@testing-library/react';
import { SymbolHeaderShellFallback } from '../SymbolHeaderShellFallback';

vi.mock('@/views/symbol/SymbolTabsSkeleton', () => ({
    SymbolTabsSkeleton: () => <div data-testid="tabs-skeleton" />,
}));

describe('SymbolHeaderShellFallback', () => {
    // 폴백은 실제 헤더(SymbolLayoutHeader)와 행 구조·폭이 같아야 전환 시 튀지 않는다.
    // 실제 헤더가 모바일에서 브레드크럼을 감추므로 폴백도 같이 감춘다.
    it('홈 마디(ko 시그렌즈) 라벨과 슬래시를 모바일에서 감추고 sm 이상에서만 보인다', () => {
        const { container } = render(<SymbolHeaderShellFallback />);

        const label = container.querySelector('header span.font-mono');
        expect(label?.textContent).toBe('시그렌즈');
        expect(label?.className).toContain('hidden');
        expect(label?.className).toContain('sm:inline');

        const slash = Array.from(container.querySelectorAll('span')).find(
            node => node.textContent === '/'
        );
        expect(slash?.className).toContain('hidden');
        expect(slash?.className).toContain('sm:inline');
    });

    it('탭 스켈레톤을 포함한다', () => {
        render(<SymbolHeaderShellFallback />);

        expect(screen.getByTestId('tabs-skeleton')).toBeInTheDocument();
    });

    it('컨트롤 자리를 3개 둔다 — ☆·공유·설정, 실제 헤더와 같은 size-11', () => {
        const { container } = render(<SymbolHeaderShellFallback />);
        const slots = container.querySelectorAll('span.size-11');
        expect(slots).toHaveLength(3);
    });
});
