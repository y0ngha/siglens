import { narrowChartDrawings } from '@/entities/analysis/lib/narrowChartDrawings';
import { layoutReportChart } from '@/entities/email-report/lib/reportChartLayout';
import {
    buildSampleBars,
    buildSampleChartMa,
    SAMPLE_CHART_SYMBOLS,
} from '@/entities/email-report/lib/sampleBars';
import {
    buildSampleDrawings,
    buildSampleReportDrawings,
} from '@/entities/email-report/lib/sampleDrawings';
import { GUIDE_PATH_BY_SKILL_NAME } from '@/shared/config/guideLinks.generated';

describe.each(SAMPLE_CHART_SYMBOLS)('샘플 작도 %s', symbol => {
    it('샘플 봉 시각에 맞고 이미지에 실제로 그려진다', () => {
        const bars = buildSampleBars(symbol);
        const layout = layoutReportChart(
            bars,
            buildSampleChartMa(bars),
            buildSampleDrawings(symbol)
        );

        expect(layout?.drawn?.lines.length).toBeGreaterThanOrEqual(3);
    });

    it('저장된 분석 결과 모양으로 직렬화해도 같은 작도로 읽힌다', () => {
        const drawings = buildSampleDrawings(symbol);
        const stored: unknown = JSON.parse(
            JSON.stringify({
                chartOverlays: drawings.overlays,
                patternSummaries: [
                    {
                        id: 'sample-ascending-triangle',
                        skillName: '상승삼각형',
                    },
                ],
            })
        );

        expect(narrowChartDrawings(stored)?.overlays).toEqual(
            drawings.overlays
        );
    });

    it('범례는 추세선 한 칸과 카드 이름 한 칸을 싣는다', () => {
        const entries = buildSampleReportDrawings(symbol)?.legend ?? [];

        const kinds = entries.map(e => e.kind);
        expect(kinds).toHaveLength(2);
        expect(kinds).toContain('card');
        expect(kinds.filter(k => k.startsWith('trend'))).toHaveLength(1);
        // 이름은 가이드 경로 표(스킬 frontmatter 생성물)에서 온 스킬 원래 이름이다.
        const card = entries.find(e => e.kind === 'card');
        expect(card?.kind === 'card' && card.name.length).toBeGreaterThan(0);
        expect(
            GUIDE_PATH_BY_SKILL_NAME[card?.kind === 'card' ? card.name : '']
        ).toMatch(/ascending-triangle$/);
    });
});
