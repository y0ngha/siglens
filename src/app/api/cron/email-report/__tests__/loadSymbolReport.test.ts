import {
    loadSymbolReport,
    type SymbolReportSources,
} from '@/app/api/cron/email-report/loadSymbolReport';
import {
    SNAPSHOT_MAX_AGE_MS,
    type SeoAnalysisSnapshot,
} from '@/entities/seo-snapshot/model';

const NOW = new Date('2026-10-08T00:00:00.000Z');

function snapshot(
    overrides: Partial<SeoAnalysisSnapshot> = {}
): SeoAnalysisSnapshot {
    return {
        symbol: 'AAPL',
        tab: 'technical',
        locale: 'ko',
        content: {
            summary: '기술적 요약',
            trend: 'bullish',
            patternSummaries: [{ patternName: 'cup', summary: '컵 패턴' }],
            strategyResults: [],
        },
        plain: '쉬운 설명',
        model: 'm',
        generatedAt: new Date('2026-10-07T21:00:00.000Z'),
        firstGeneratedAt: null,
        updatedAt: new Date('2026-10-07T21:00:00.000Z'),
        ...overrides,
    };
}

function sources(
    overrides: Partial<SymbolReportSources> = {}
): SymbolReportSources {
    return {
        findSnapshots: vi.fn().mockResolvedValue([
            snapshot(),
            snapshot({
                tab: 'options',
                content: {
                    summary: '옵션 요약',
                    perExpiration: [],
                    signals: [],
                },
            }),
        ]),
        getNews: vi.fn().mockResolvedValue([]),
        getOptionsMetrics: vi.fn().mockResolvedValue(null),
        ...overrides,
    };
}

describe('loadSymbolReport', () => {
    it('신선한 스냅샷의 기술적 분석·쉽게보기·옵션 산문을 싣는다', async () => {
        const src = sources();

        const report = await loadSymbolReport('AAPL', 'ja', NOW, src);

        expect(src.findSnapshots).toHaveBeenCalledWith('AAPL', 'ja');
        expect(src.getNews).toHaveBeenCalledWith('AAPL', 'ja');
        expect(report.technical?.summary).toBe('기술적 요약');
        expect(report.technical?.patterns).toEqual(['컵 패턴']);
        expect(report.plain).toBe('쉬운 설명');
        expect(report.options?.summary).toBe('옵션 요약');
        expect(report.analyzedAt).toBe('2026-10-07T21:00:00.000Z');
    });

    it('최대 보관 기간보다 오래된 스냅샷은 쓰지 않는다', async () => {
        const stale = new Date(NOW.getTime() - SNAPSHOT_MAX_AGE_MS - 1);
        const src = sources({
            findSnapshots: vi
                .fn()
                .mockResolvedValue([snapshot({ generatedAt: stale })]),
        });

        const report = await loadSymbolReport('AAPL', 'ko', NOW, src);

        expect(report.technical).toBeNull();
        expect(report.plain).toBeNull();
    });

    it('경계값(정확히 최대 보관 기간)은 신선한 것으로 본다', async () => {
        const edge = new Date(NOW.getTime() - SNAPSHOT_MAX_AGE_MS);
        const src = sources({
            findSnapshots: vi
                .fn()
                .mockResolvedValue([snapshot({ generatedAt: edge })]),
        });

        const report = await loadSymbolReport('AAPL', 'ko', NOW, src);

        expect(report.technical).not.toBeNull();
    });

    it('한 소스가 실패해도 다른 섹션은 채운다', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const src = sources({
            getNews: vi.fn().mockRejectedValue(new Error('db down')),
        });

        const report = await loadSymbolReport('AAPL', 'ko', NOW, src);

        expect(report.news).toEqual([]);
        expect(report.technical?.summary).toBe('기술적 요약');
    });

    it('스냅샷 조회가 실패하면 분석 칸만 비운다', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const src = sources({
            findSnapshots: vi.fn().mockRejectedValue(new Error('db down')),
        });

        const report = await loadSymbolReport('AAPL', 'ko', NOW, src);

        expect(report.technical).toBeNull();
        expect(report.options).toBeNull();
    });
});
