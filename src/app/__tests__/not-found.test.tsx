// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import RootNotFound, { metadata } from '../not-found';

/**
 * 루트 레이아웃이 없는 자리(전 라우트가 `[locale]/` 아래로 이동)의 404 — 이
 * 파일이 직접 `<html>`/`<body>`와 스타일시트를 맡는다(`global-error.tsx`와 같은
 * 이유). jsdom은 이 자체 html/body 출력을 그대로 렌더한다.
 */
describe('RootNotFound', () => {
    it('404 코드를 보여준다', () => {
        render(<RootNotFound />);
        expect(screen.getByText('404')).toBeInTheDocument();
    });

    it('한국어·영어 병기 안내를 보여준다 — 로케일을 알 수 없는 자리라서다', () => {
        render(<RootNotFound />);
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            '페이지를 찾을 수 없습니다'
        );
        expect(screen.getByText('Page not found')).toBeInTheDocument();
        expect(
            screen.getByText(/The page may have moved or been removed\./)
        ).toBeInTheDocument();
    });

    it('전체 페이지 로드가 되도록 <a href="/">로 홈 링크를 건다', () => {
        render(<RootNotFound />);
        const link = screen.getByRole('link', { name: /홈으로 \/ Home/ });
        expect(link.tagName).toBe('A');
        expect(link).toHaveAttribute('href', '/');
    });

    it('metadata는 noindex이고 제목을 한국어·영어로 병기한다', () => {
        expect(metadata.title).toBe(
            '페이지를 찾을 수 없습니다 / Page not found'
        );
        expect(metadata.robots).toEqual({ index: false, follow: true });
    });
});
