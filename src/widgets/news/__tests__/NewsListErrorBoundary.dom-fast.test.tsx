import { render, screen } from '@testing-library/react';
import { NewsListErrorBoundary } from '../NewsListErrorBoundary';

/**
 * `NewsList`는 지속되는 폴링 오류를 다시 던진다. 그 throw를 섹션 안에서 잡지
 * 않으면 `[symbol]/error.tsx`까지 올라가 헤더·탭 레일·관련 종목을 포함한
 * **심볼 라우트 전체**가 오류 한 장으로 바뀐다(감사 실측: `/AAPL/news`가 SSR로
 * 1,022자를 낸 뒤 본문이 1,079 → 582자로 줄고 h1이 오류 문구가 됐다).
 *
 * 형제인 `NewsAiSummary`는 이미 자기 바운더리를 갖고 있었다 — 같은 의도의 둘 중
 * 하나만 감싸여 있었던 셈이다.
 */
function Boom(): never {
    throw new Error('poll failed');
}

describe('NewsListErrorBoundary', () => {
    it('섹션 안에서 잡아 폴백을 그린다', () => {
        // 이 테스트가 통과하려면 throw가 render 밖으로 새지 않아야 한다 —
        // 새면 render 자체가 던져 케이스가 실패한다.
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        render(
            <NewsListErrorBoundary>
                <Boom />
            </NewsListErrorBoundary>
        );
        expect(screen.getByText('최근 뉴스')).toBeInTheDocument();
        spy.mockRestore();
    });

    it('오류가 없으면 자식을 그대로 그린다', () => {
        render(
            <NewsListErrorBoundary>
                <p>기사 목록</p>
            </NewsListErrorBoundary>
        );
        expect(screen.getByText('기사 목록')).toBeInTheDocument();
    });
});
