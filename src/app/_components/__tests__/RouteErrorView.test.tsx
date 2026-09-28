// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouteErrorView } from '../RouteErrorView';

const { mockReportClientError } = vi.hoisted(() => ({
    mockReportClientError: vi.fn(),
}));
vi.mock('@/shared/lib/reportClientError', () => ({
    reportClientError: mockReportClientError,
}));

const error = Object.assign(new Error('boom'), { digest: 'deadbeef' });

function renderView(
    overrides: Partial<Parameters<typeof RouteErrorView>[0]> = {}
) {
    return render(
        <RouteErrorView
            error={error}
            reset={vi.fn()}
            logTag="TestRoute"
            eyebrow="eyebrow"
            title="title"
            body="body"
            retryLabel="retry"
            homeLabel="home"
            {...overrides}
        />
    );
}

describe('RouteErrorView', () => {
    it('전달받은 문구를 그대로 렌더한다 (번역은 호출부 몫)', () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        renderView();
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            'title'
        );
        expect(screen.getByText('eyebrow')).toBeInTheDocument();
        expect(screen.getByText('body')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'home' })).toHaveAttribute(
            'href',
            '/'
        );
    });

    it('logTag로 콘솔 로그와 클라이언트 에러 리포트를 남긴다', () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        renderView();
        expect(errorSpy).toHaveBeenCalledWith(
            '[TestRoute] render error:',
            error
        );
        expect(mockReportClientError).toHaveBeenCalledWith(
            error,
            'TestRoute',
            'deadbeef'
        );
        errorSpy.mockRestore();
    });

    it('기본 컨테이너는 page-container, 종목 라우트는 symbol-container', () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const { container, unmount } = renderView();
        expect(container.querySelector('main')).toHaveClass('page-container');
        unmount();

        const symbol = renderView({ containerClassName: 'symbol-container' });
        expect(symbol.container.querySelector('main')).toHaveClass(
            'symbol-container'
        );
    });
});
