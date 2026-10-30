import type { SymbolReportOptions } from '@/entities/email-report/reportModel';
import {
    optionsHtml,
    optionsLines,
    optionsMetricLines,
} from '@/entities/email-report/templates/optionsSection';

const t = (key: string, values?: Record<string, string>): string =>
    values ? `${key}(${Object.values(values).join(',')})` : key;

const FULL: SymbolReportOptions = {
    expirationDate: '2026-10-16',
    putCallRatio: 0.743,
    atmImpliedVolatility: 0.52,
    impliedMovePercent: 6.14,
    summary: '옵션 <요약>',
};

describe('optionsMetricLines', () => {
    it('값이 있는 지표를 라벨: 값 줄로 만든다', () => {
        expect(optionsMetricLines(FULL, t)).toEqual([
            'optionsPutCall: 0.74',
            'optionsIv: 52.0%',
            'optionsMove(2026-10-16): ±6.1%',
        ]);
    });

    it('null 지표는 뺀다', () => {
        expect(
            optionsMetricLines(
                {
                    ...FULL,
                    putCallRatio: null,
                    atmImpliedVolatility: null,
                },
                t
            )
        ).toEqual(['optionsMove(2026-10-16): ±6.1%']);
    });

    it('만기일이 비면 변동폭 줄도 뺀다', () => {
        expect(optionsMetricLines({ ...FULL, expirationDate: '' }, t)).toEqual([
            'optionsPutCall: 0.74',
            'optionsIv: 52.0%',
        ]);
    });
});

describe('optionsHtml', () => {
    it('옵션이 없으면 빈 문자열', () => {
        expect(optionsHtml(null, t)).toBe('');
    });

    it('지표도 요약도 없으면 빈 문자열', () => {
        expect(
            optionsHtml(
                {
                    expirationDate: '',
                    putCallRatio: null,
                    atmImpliedVolatility: null,
                    impliedMovePercent: null,
                    summary: null,
                },
                t
            )
        ).toBe('');
    });

    it('지표 목록과 이스케이프된 요약을 함께 그린다', () => {
        const html = optionsHtml(FULL, t);

        expect(html).toContain('sectionOptions');
        expect(html).toContain('optionsPutCall: 0.74');
        expect(html).toContain('옵션 &lt;요약&gt;');
    });

    it('지표가 없고 요약만 있으면 목록 없이 요약만 그린다', () => {
        const html = optionsHtml(
            {
                expirationDate: '',
                putCallRatio: null,
                atmImpliedVolatility: null,
                impliedMovePercent: null,
                summary: '요약만',
            },
            t
        );

        expect(html).not.toContain('<ul');
        expect(html).toContain('요약만');
    });
});

describe('optionsLines', () => {
    it('옵션이 없으면 빈 배열', () => {
        expect(optionsLines(null, t)).toEqual([]);
    });

    it('제목·지표·요약을 차례로 낸다', () => {
        expect(optionsLines(FULL, t)).toEqual([
            '',
            '[sectionOptions]',
            'optionsPutCall: 0.74',
            'optionsIv: 52.0%',
            'optionsMove(2026-10-16): ±6.1%',
            '옵션 <요약>',
        ]);
    });
});
