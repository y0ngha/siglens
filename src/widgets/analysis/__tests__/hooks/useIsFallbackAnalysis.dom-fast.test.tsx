import { renderHook } from '@testing-library/react';
import { buildFallbackAnalysis } from '@/entities/analysis/lib/fallbackAnalysis';
import { IntlTestProvider } from '@/shared/test-utils/intlRenderWrapper';
import { useIsFallbackAnalysis } from '@/widgets/analysis/hooks/useIsFallbackAnalysis';
import koMessages from '../../../../../messages/ko.json';

const FALLBACK_SUMMARY = koMessages.entities.analysis.fallback.unavailable;

describe('useIsFallbackAnalysis', () => {
    it('실제 카탈로그 문구로 만든 폴백 응답이면 true다', () => {
        const { result } = renderHook(
            () =>
                useIsFallbackAnalysis(buildFallbackAnalysis(FALLBACK_SUMMARY)),
            { wrapper: IntlTestProvider }
        );
        expect(result.current).toBe(true);
    });

    it('서사가 있는 응답이면 false다', () => {
        const analysis = {
            ...buildFallbackAnalysis(FALLBACK_SUMMARY),
            summary: '실제 분석 요약',
        };
        const { result } = renderHook(() => useIsFallbackAnalysis(analysis), {
            wrapper: IntlTestProvider,
        });
        expect(result.current).toBe(false);
    });
});
