// @vitest-environment jsdom
import { createElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { act, renderHook } from '@testing-library/react';
import { useHydrated } from '@/shared/hooks/useHydrated';

function Probe({ onRender }: { onRender: (value: boolean) => void }) {
    const isHydrated = useHydrated();
    onRender(isHydrated);
    return createElement('span', null, isHydrated ? 'client' : 'server');
}

describe('useHydrated', () => {
    it('클라이언트 마운트(하이드레이션 아님)는 첫 렌더부터 true다', () => {
        const values: boolean[] = [];
        renderHook(() => {
            const value = useHydrated();
            values.push(value);
            return value;
        });
        // 예전 effect+setState 구현은 [false, true]로 두 번 그렸다.
        expect(values).toEqual([true]);
    });

    it('리렌더 사이에 값이 안정적이다', () => {
        const { result, rerender } = renderHook(() => useHydrated());
        const first = result.current;
        rerender();
        expect(result.current).toBe(first);
    });

    it('서버 렌더는 false다', () => {
        const html = renderToString(
            createElement(Probe, { onRender: () => {} })
        );
        expect(html).toContain('server');
    });

    it('하이드레이션은 서버 값(false)으로 맞춘 뒤 true로 다시 그린다 — 불일치 경고 없이', async () => {
        const onRender = vi.fn();
        const container = document.createElement('div');
        container.innerHTML = renderToString(
            createElement(Probe, { onRender: () => {} })
        );
        document.body.appendChild(container);
        const onRecoverableError = vi.fn();

        await act(async () => {
            hydrateRoot(container, createElement(Probe, { onRender }), {
                onRecoverableError,
            });
        });

        expect(onRender.mock.calls.map(call => call[0])).toEqual([false, true]);
        expect(container.textContent).toBe('client');
        expect(onRecoverableError).not.toHaveBeenCalled();
        container.remove();
    });
});
