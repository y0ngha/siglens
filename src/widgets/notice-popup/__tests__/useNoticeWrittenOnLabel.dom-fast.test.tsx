import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { withLocale } from '@/shared/test-utils/intlRenderWrapper';
import { useNoticeWrittenOnLabel } from '../hooks/useNoticeWrittenOnLabel';

describe('useNoticeWrittenOnLabel', () => {
    it('로컬 날짜를 0을 채운 연·월·일로 ko 문구에 넣는다', () => {
        const { result } = renderHook(() =>
            useNoticeWrittenOnLabel(new Date(2026, 0, 5))
        );
        expect(result.current).toBe('2026.01.05 작성');
    });

    it('로케일 카탈로그의 어순을 따른다(en)', () => {
        const { result } = renderHook(
            () => useNoticeWrittenOnLabel(new Date(2026, 10, 23)),
            {
                wrapper: ({ children }: { children: ReactNode }) =>
                    withLocale(children, 'en'),
            }
        );
        expect(result.current).toBe('Written 2026.11.23');
    });

    it('읽을 수 없는 날짜면 빈 문자열이다', () => {
        const { result } = renderHook(() =>
            useNoticeWrittenOnLabel(new Date(Number.NaN))
        );
        expect(result.current).toBe('');
    });
});
