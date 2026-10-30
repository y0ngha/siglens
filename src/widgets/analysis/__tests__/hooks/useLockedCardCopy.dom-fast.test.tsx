import { renderHook } from '@testing-library/react';
import { IntlTestProvider } from '@/shared/test-utils/intlRenderWrapper';
import type { MeterState } from '@/shared/lib/funnel/funnelEvents';
import { useLockedCardCopy } from '@/widgets/analysis/hooks/useLockedCardCopy';
import koMessages from '../../../../../messages/ko.json';

const PANEL = koMessages.widgets.analysis.panel;
const LEGACY = koMessages.widgets.analysis.AnalysisPanel;

function render(meter: MeterState | null, skillCount: number) {
    return renderHook(() => useLockedCardCopy(meter, skillCount), {
        wrapper: IntlTestProvider,
    }).result.current;
}

describe('useLockedCardCopy', () => {
    it('미터가 소진되면 소진 제목·본문이 스킬 업셀보다 우선한다', () => {
        const copy = render('exhausted', 40);
        expect(copy.title).toBe(PANEL.meter.exhaustedTitle);
        // 종목 수는 core 정책 값으로 채워진다(ICU plural 원문이 남지 않는다).
        expect(copy.body).toMatch(/하루 \d+종목/);
    });

    it('잠긴 스킬 수가 있으면 스킬 업셀 본문이다', () => {
        const copy = render(null, 40);
        expect(copy.title).toBe(LEGACY['120a0a']);
        expect(copy.body).toContain('40');
    });

    it('둘 다 아니면 기본 문구다', () => {
        const copy = render(null, 0);
        expect(copy.body).toBe(LEGACY.f0256c);
    });
});
