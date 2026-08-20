import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NavigationProgressBar } from '@/features/ticker-search/ui/NavigationProgressBar';

describe('NavigationProgressBar', () => {
    it('접근 이름을 가진 progressbar로 렌더된다', () => {
        render(<NavigationProgressBar />);
        expect(
            screen.getByRole('progressbar', { name: '종목 페이지 이동 중' })
        ).toBeInTheDocument();
    });

    it('음성 고지를 자기 안에 두지 않는다', () => {
        // `progressbar`는 ARIA의 "children presentational" 역할이라 자손이 접근성
        // 트리에서 제거된다. 안에 sr-only 문구를 넣어도 **읽히지 않는다** — 한때
        // 그렇게 만들어 뒀다가 감사에서 잡혔다. 고지는 `SearchOverlayProvider`가
        // 형제로 둔 `role="status"`가 맡는다.
        render(<NavigationProgressBar />);
        const bar = screen.getByRole('progressbar');
        expect(bar).toHaveTextContent('');
        expect(bar).not.toHaveAttribute('aria-live');
    });

    it('상단 안전영역만큼 내려 그린다', () => {
        // `viewportFit: cover` + standalone PWA에서 `top-0`는 상태바 뒤에 깔린다.
        // 56px 헤더는 일부 가려도 살아남지만 2px 바는 통째로 사라져 유일한 피드백이
        // 없어진다.
        render(<NavigationProgressBar />);
        expect(screen.getByRole('progressbar').className).toContain(
            'top-[env(safe-area-inset-top,0px)]'
        );
    });

    it('모션 최소화 설정에서는 애니메이션 대신 정적 막대를 남긴다', () => {
        const { container } = render(<NavigationProgressBar />);
        const fill = container.querySelector('[role=progressbar] > div');
        expect(fill?.className).toContain('motion-reduce:animate-none');
        expect(fill?.className).toContain('motion-reduce:w-full');
    });
});
