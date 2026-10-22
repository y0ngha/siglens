import { beforeEach, describe, expect, it, vi } from 'vitest';

const correctKrSymbolSuffix = vi.hoisted(() => vi.fn());
vi.mock('@/entities/ticker/lib/koreanNameStore', () => ({
    correctKrSymbolSuffix,
}));

import {
    applyKrSymbolCorrections,
    correctKrSymbolArgs,
    singleSymbolCorrection,
    symbolListCorrection,
} from '@/app/api/ai/chat/tools/krSymbolCorrection';

const MASTER: Record<string, string> = {
    '253450.KS': '253450.KQ',
    '033790.KS': '033790.KQ',
};

describe('correctKrSymbolArgs', () => {
    beforeEach(() => {
        correctKrSymbolSuffix.mockReset();
        correctKrSymbolSuffix.mockImplementation(async (s: string) => {
            const upper = s.toUpperCase();
            return MASTER[upper] ?? upper;
        });
    });

    it('단일 symbol 인자를 교정하고 결과에 symbolCorrectedFrom을 싣는다', async () => {
        const { args, annotate } = await correctKrSymbolArgs(
            {
                symbol: '253450.KS',
                timeframe: '1Day',
            },
            'get_quote'
        );
        expect(args).toEqual({ symbol: '253450.KQ', timeframe: '1Day' });
        expect(annotate({ symbol: '253450.KQ', found: true })).toEqual({
            symbolCorrectedFrom: '253450.KS',
            symbol: '253450.KQ',
            found: true,
        });
    });

    it('symbols 목록은 한국 종목만 교정하고 symbolCorrections로 기록한다', async () => {
        const { args, annotate } = await correctKrSymbolArgs(
            {
                symbols: ['AAPL', '033790.KS', '005930.KS'],
            },
            'get_quote'
        );
        expect(args.symbols).toEqual(['AAPL', '033790.KQ', '005930.KS']);
        expect(annotate({ quotes: [] })).toEqual({
            symbolCorrections: [{ from: '033790.KS', to: '033790.KQ' }],
            quotes: [],
        });
    });

    it('교정이 없으면 인자와 결과를 그대로 둔다', async () => {
        const input = { symbol: '005930.KS' };
        const { args, annotate } = await correctKrSymbolArgs(
            input,
            'get_quote'
        );
        expect(args).toBe(input);
        const result = { found: true };
        expect(annotate(result)).toBe(result);
    });

    it('한국 종목 심볼이 없으면 마스터를 읽지 않는다', async () => {
        await correctKrSymbolArgs(
            { symbol: 'AAPL', symbols: ['MSFT'] },
            'get_quote'
        );
        expect(correctKrSymbolSuffix).not.toHaveBeenCalled();
    });

    it('마스터 조회가 throw해도 원래 심볼로 실행하고, 오류 이름만 남긴다', async () => {
        const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
        const error = new Error('bound param 253450.KS leaked');
        error.name = 'DrizzleQueryError';
        correctKrSymbolSuffix.mockRejectedValue(error);
        const input = { symbol: '253450.KS' };
        const { args } = await correctKrSymbolArgs(input, 'get_quote');
        expect(args).toBe(input);
        expect(logged).toHaveBeenCalledWith(
            '[AgentTool]',
            'get_quote',
            'kr symbol suffix correction failed, degrading',
            { errorName: 'DrizzleQueryError', code: undefined }
        );
        expect(JSON.stringify(logged.mock.calls)).not.toContain('bound param');
        logged.mockRestore();
    });

    it('객체가 아닌 결과에는 기록을 붙이지 않는다', async () => {
        const { annotate } = await correctKrSymbolArgs(
            { symbol: '253450.KS' },
            'get_quote'
        );
        expect(annotate(['x'])).toEqual(['x']);
    });
});

describe('singleSymbolCorrection', () => {
    it('마스터가 다른 접미사를 고르면 교정 한 건', () => {
        expect(singleSymbolCorrection('253450.KS', '253450.KQ')).toEqual({
            from: '253450.KS',
            to: '253450.KQ',
        });
    });
    it('같거나 대소문자만 다르면 null', () => {
        expect(singleSymbolCorrection('005930.KS', '005930.KS')).toBeNull();
        expect(singleSymbolCorrection('005930.ks', '005930.KS')).toBeNull();
    });
});

describe('symbolListCorrection', () => {
    it('바뀐 항목만 기록하고 교정된 전체 목록을 돌려준다', () => {
        expect(
            symbolListCorrection(
                ['AAPL', '033790.KS', '005930.KS'],
                ['AAPL', '033790.KQ', '005930.KS']
            )
        ).toEqual({
            symbols: ['AAPL', '033790.KQ', '005930.KS'],
            corrections: [{ from: '033790.KS', to: '033790.KQ' }],
        });
    });
    it('바뀐 항목이 없으면 null (문자열이 아닌 항목은 무시)', () => {
        expect(
            symbolListCorrection(['005930.KS', 7], ['005930.KS', 7])
        ).toBeNull();
    });
});

describe('applyKrSymbolCorrections', () => {
    it('교정이 없으면 입력 인자 객체와 결과를 그대로 둔다', () => {
        const input = { symbol: '005930.KS' };
        const { args, annotate } = applyKrSymbolCorrections(input, null, null);
        expect(args).toBe(input);
        expect(annotate({ ok: true })).toEqual({ ok: true });
    });
    it('단일·목록 교정을 인자와 결과 기록에 함께 싣는다', () => {
        const { args, annotate } = applyKrSymbolCorrections(
            { symbol: '253450.KS', symbols: ['033790.KS'] },
            { from: '253450.KS', to: '253450.KQ' },
            {
                symbols: ['033790.KQ'],
                corrections: [{ from: '033790.KS', to: '033790.KQ' }],
            }
        );
        expect(args).toEqual({ symbol: '253450.KQ', symbols: ['033790.KQ'] });
        expect(annotate({ found: true })).toEqual({
            symbolCorrectedFrom: '253450.KS',
            symbolCorrections: [{ from: '033790.KS', to: '033790.KQ' }],
            found: true,
        });
        expect(annotate('text')).toBe('text');
    });
});
