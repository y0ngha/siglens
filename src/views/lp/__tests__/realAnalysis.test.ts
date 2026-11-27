import { describe, expect, it } from 'vitest';
import type { SeoAnalysisSnapshot } from '@/entities/seo-snapshot/model';
import { resolveSnapshotAsOf } from '@/shared/lib/formatSnapshotAsOf';
import koMessages from '../../../../messages/ko.json';
import {
    buildLpRealAnalysis,
    LP_EXCERPT_MAX_CHARS,
    LP_TREND_LABEL,
    selectLpExcerpt,
    splitPlainParagraphs,
} from '../lib/realAnalysis';
import { LP_ANALYSIS_SUBJECTS } from '../lib/stockAnalysisContent';

const [NVDA, SAMSUNG] = LP_ANALYSIS_SUBJECTS;
if (NVDA === undefined || SAMSUNG === undefined) {
    throw new Error('LP_ANALYSIS_SUBJECTS must list NVDA and 005930.KS');
}

const SENTENCE = '추세선 위에서 거래량이 늘며 흐름을 이어가고 있습니다. ';
const sentences = (count: number): string =>
    Array.from({ length: count }, () => SENTENCE)
        .join('')
        .trim();
const cp = (text: string): number => [...text].length;

/** Shape stored by the prewarm cron for the technical tab (barTime is epoch seconds). */
const BAR_TIME_SEC = Date.UTC(2026, 10, 19, 5, 0, 0) / 1000;
const ANALYZED_AT = '2026-11-20T01:10:00.000Z';
const GENERATED_AT = new Date('2026-11-20T01:12:00.000Z');

function storedContent(overrides: Record<string, unknown> = {}) {
    return {
        summary:
            '엔비디아는 단기 이동평균선 아래로 내려와 조정을 받고 있습니다.',
        trend: 'bearish',
        dataAsOf: { barTime: BAR_TIME_SEC, close: 186.5 },
        analyzedAt: ANALYZED_AT,
        patternSummaries: [],
        strategyResults: [],
        ...overrides,
    };
}

function row(
    overrides: Partial<SeoAnalysisSnapshot> = {}
): SeoAnalysisSnapshot {
    return {
        symbol: 'NVDA',
        tab: 'technical',
        locale: 'ko',
        content: storedContent(),
        plain: '첫 문단은 짧게 흐름을 설명합니다.\n\n두 번째 문단은 가격대를 설명합니다.',
        model: 'm',
        generatedAt: GENERATED_AT,
        firstGeneratedAt: null,
        updatedAt: GENERATED_AT,
        ...overrides,
    };
}

describe('splitPlainParagraphs', () => {
    it('splits on blank lines and trims', () => {
        expect(splitPlainParagraphs('  가나다. \n\n 라마바. ')).toEqual([
            '가나다.',
            '라마바.',
        ]);
    });

    it('treats whitespace-only lines as separators and drops empty parts', () => {
        expect(splitPlainParagraphs('가.\n   \n나.\n\n\n   \n')).toEqual([
            '가.',
            '나.',
        ]);
    });

    it('returns [] for blank input', () => {
        expect(splitPlainParagraphs('  \n\n ')).toEqual([]);
    });
});

describe('selectLpExcerpt', () => {
    it('keeps both paragraphs when the total fits the budget', () => {
        const a = sentences(3);
        const b = sentences(3);
        expect(cp(a) + cp(b)).toBeLessThanOrEqual(LP_EXCERPT_MAX_CHARS);
        expect(selectLpExcerpt([a, b, '세 번째 문단입니다.'])).toEqual([a, b]);
    });

    it('keeps only the lead paragraph when the second would exceed the budget', () => {
        const a = sentences(8);
        const b = sentences(8);
        expect(cp(a)).toBeLessThanOrEqual(LP_EXCERPT_MAX_CHARS);
        expect(cp(a) + cp(b)).toBeGreaterThan(LP_EXCERPT_MAX_CHARS);
        expect(selectLpExcerpt([a, b])).toEqual([a]);
    });

    it('keeps only the lead paragraph when there is no second', () => {
        expect(selectLpExcerpt(['짧은 문단입니다.'])).toEqual([
            '짧은 문단입니다.',
        ]);
    });

    it('clamps an over-long lead at a sentence end and drops the second', () => {
        const long = sentences(30);
        expect(cp(long)).toBeGreaterThan(LP_EXCERPT_MAX_CHARS);
        const [only, ...rest] = selectLpExcerpt([long, sentences(8)]);
        expect(rest).toEqual([]);
        expect(only?.endsWith('다.')).toBe(true);
        expect(cp(only ?? '')).toBeLessThanOrEqual(LP_EXCERPT_MAX_CHARS);
    });

    it('does not append a short second paragraph after a clamped lead', () => {
        const long = sentences(30);
        const short = '두 번째 문단입니다.';
        const result = selectLpExcerpt([long, short]);
        expect(result).toHaveLength(1);
        expect(result).not.toContain(short);
        expect(cp(result[0] ?? '') + cp(short)).toBeLessThanOrEqual(
            LP_EXCERPT_MAX_CHARS
        );
    });

    it('drops a paragraph with a middle dot', () => {
        expect(
            selectLpExcerpt(['시세·차트 흐름입니다.', '깨끗한 문단입니다.'])
        ).toEqual(['깨끗한 문단입니다.']);
    });

    it('drops a paragraph with crypto wording', () => {
        expect(
            selectLpExcerpt(['비트코인 이야기입니다.', '깨끗한 문단입니다.'])
        ).toEqual(['깨끗한 문단입니다.']);
    });

    it('returns [] when both leading paragraphs break the rules', () => {
        expect(
            selectLpExcerpt([
                '시세·차트 흐름입니다.',
                '비트코인 이야기입니다.',
                '세 번째는 깨끗하지만 후보가 아닙니다.',
            ])
        ).toEqual([]);
    });

    it('returns [] for no paragraphs', () => {
        expect(selectLpExcerpt([])).toEqual([]);
    });
});

describe('buildLpRealAnalysis', () => {
    it('builds the NVDA card from a stored-shape row', () => {
        const card = buildLpRealAnalysis(NVDA, row());
        const resolved = resolveSnapshotAsOf(
            {
                barTimeMs: BAR_TIME_SEC * 1000,
                analyzedAtMs: new Date(ANALYZED_AT).getTime(),
                generatedAtMs: GENERATED_AT.getTime(),
            },
            'us-equity'
        );
        expect(card).toEqual({
            symbol: 'NVDA',
            name: '엔비디아',
            href: 'https://siglens.io/NVDA',
            trendLabel: '약세',
            asOfIso: resolved?.instant.toISOString(),
            asOfLabel: '2026년 11월 19일 미국 장 마감 기준',
            paragraphs: [
                '첫 문단은 짧게 흐름을 설명합니다.',
                '두 번째 문단은 가격대를 설명합니다.',
            ],
        });
    });

    it('labels a KR subject with the domestic close suffix', () => {
        const barTimeSec = Date.UTC(2026, 10, 19, 15, 0, 0) / 1000; // 2026-11-20 00:00 KST
        const card = buildLpRealAnalysis(
            SAMSUNG,
            row({
                symbol: '005930.KS',
                content: storedContent({
                    dataAsOf: { barTime: barTimeSec, close: 70000 },
                }),
            })
        );
        expect(card?.asOfLabel).toBe('2026년 11월 20일 국내 장 마감 기준');
        expect(card?.href).toBe('https://siglens.io/005930.KS');
    });

    it('maps every trend to its label and gives null without a trend', () => {
        expect(
            buildLpRealAnalysis(
                NVDA,
                row({ content: storedContent({ trend: 'bullish' }) })
            )?.trendLabel
        ).toBe('강세');
        expect(
            buildLpRealAnalysis(
                NVDA,
                row({ content: storedContent({ trend: 'neutral' }) })
            )?.trendLabel
        ).toBe('보합');
        expect(
            buildLpRealAnalysis(
                NVDA,
                row({ content: storedContent({ trend: 'sideways' }) })
            )?.trendLabel
        ).toBeNull();
    });

    it('falls back to analyzedAt then generatedAt when there is no barTime', () => {
        const withAnalyzedAt = buildLpRealAnalysis(
            NVDA,
            row({ content: storedContent({ dataAsOf: undefined }) })
        );
        expect(withAnalyzedAt?.asOfLabel).toBe(
            '2026년 11월 19일 미국 장 마감 기준'
        );
        const generatedOnly = buildLpRealAnalysis(
            NVDA,
            row({
                content: storedContent({
                    dataAsOf: undefined,
                    analyzedAt: undefined,
                }),
            })
        );
        expect(generatedOnly?.asOfLabel).toBe(
            '2026년 11월 19일 미국 장 마감 기준'
        );
    });

    it('returns null without a snapshot', () => {
        expect(buildLpRealAnalysis(NVDA, undefined)).toBeNull();
    });

    it('returns null when the content cannot back a card', () => {
        expect(
            buildLpRealAnalysis(NVDA, row({ content: 'broken' }))
        ).toBeNull();
        expect(
            buildLpRealAnalysis(
                NVDA,
                row({ content: { summary: '', patternSummaries: [] } })
            )
        ).toBeNull();
    });

    it('returns null when there is no plain prose', () => {
        expect(buildLpRealAnalysis(NVDA, row({ plain: null }))).toBeNull();
    });

    it('returns null when plain has no usable paragraph', () => {
        expect(buildLpRealAnalysis(NVDA, row({ plain: ' \n\n ' }))).toBeNull();
        expect(
            buildLpRealAnalysis(
                NVDA,
                row({ plain: '시세·차트입니다.\n\n비트코인입니다.' })
            )
        ).toBeNull();
    });

    it('returns null when no data date resolves', () => {
        expect(
            buildLpRealAnalysis(
                NVDA,
                row({
                    content: storedContent({
                        dataAsOf: undefined,
                        analyzedAt: undefined,
                    }),
                    generatedAt: new Date(Number.NaN),
                })
            )
        ).toBeNull();
    });
});

describe('LP_TREND_LABEL', () => {
    it('matches shared.enumLabel.trend in the ko catalog', () => {
        expect(LP_TREND_LABEL).toEqual(koMessages.shared.enumLabel.trend);
    });
});
