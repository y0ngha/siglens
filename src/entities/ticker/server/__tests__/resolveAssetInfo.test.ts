const { getAssetInfo } = vi.hoisted(() => ({ getAssetInfo: vi.fn() }));
vi.mock('@/entities/ticker/server/getAssetInfo', () => ({ getAssetInfo }));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    resolveAssetInfoOrNull,
    resolveAssetLookup,
    resolvedInstrumentFields,
} from '@/entities/ticker/server/resolveAssetInfo';

describe('resolveAssetLookup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('a found asset is returned with lookupFailed false', async () => {
        const asset = { symbol: 'AAPL', name: 'Apple' };
        getAssetInfo.mockResolvedValue(asset);
        await expect(
            resolveAssetLookup('AAPL', 'get_price_stats')
        ).resolves.toEqual({ asset, lookupFailed: false });
    });

    it('a lookup that succeeded with null is a definite unknown symbol (lookupFailed false)', async () => {
        getAssetInfo.mockResolvedValue(null);
        await expect(
            resolveAssetLookup('TYPO', 'get_price_stats')
        ).resolves.toEqual({ asset: null, lookupFailed: false });
    });

    it('a lookup that threw is null with lookupFailed true, logging only the error name', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const error = new Error('bound param leaked');
        error.name = 'DrizzleQueryError';
        getAssetInfo.mockRejectedValue(error);
        await expect(
            resolveAssetLookup('AAPL', 'get_price_stats')
        ).resolves.toEqual({ asset: null, lookupFailed: true });
        expect(warn).toHaveBeenCalledWith(
            '[AgentTool]',
            'get_price_stats',
            'getAssetInfo failed, degrading',
            { errorName: 'DrizzleQueryError' }
        );
    });
});

describe('resolveAssetInfoOrNull', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('성공 시 getAssetInfo의 결과를 그대로 반환한다', async () => {
        const asset = { symbol: 'AAPL', name: 'Apple', fmpSymbol: 'AAPL' };
        getAssetInfo.mockResolvedValue(asset);
        const result = await resolveAssetInfoOrNull(
            'AAPL',
            'get_bars_indicators'
        );
        expect(result).toBe(asset);
    });

    it('getAssetInfo가 throw하면 null로 저하되고, 에러 name만 로그한다(message는 절대 노출하지 않는다)', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const error = new Error('bound param: user 123 leaked in message');
        error.name = 'DrizzleQueryError';
        getAssetInfo.mockRejectedValue(error);

        const result = await resolveAssetInfoOrNull('AAPL', 'get_quote');

        expect(result).toBeNull();
        expect(warn).toHaveBeenCalledWith(
            '[AgentTool]',
            'get_quote',
            'getAssetInfo failed, degrading',
            { errorName: 'DrizzleQueryError' }
        );
        // Never forward the raw message — it can embed bound params (see
        // `logToolError` in `features/agent-tools/server/createToolExecutor.ts`
        // for the same privacy rule).
        const loggedArgs = warn.mock.calls.find(
            call => call[1] === 'get_quote'
        );
        expect(JSON.stringify(loggedArgs)).not.toContain('bound param');
    });

    it('non-Error를 throw해도 errorName은 "unknown"으로 degrade된다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        getAssetInfo.mockRejectedValue('not an Error instance');

        const result = await resolveAssetInfoOrNull(
            'AAPL',
            'run_fresh_analysis'
        );

        expect(result).toBeNull();
        expect(warn).toHaveBeenCalledWith(
            '[AgentTool]',
            'run_fresh_analysis',
            'getAssetInfo failed, degrading',
            { errorName: 'unknown' }
        );
    });
});

describe('resolvedInstrumentFields', () => {
    it('해석된 종목명과, 요청 심볼과 다른 공급자 심볼을 싣는다', () => {
        expect(
            resolvedInstrumentFields({
                symbol: 'VIX',
                name: 'VIX',
                fmpSymbol: '^VIX',
            })
        ).toEqual({ resolvedName: 'VIX', resolvedSymbol: '^VIX' });
    });

    it('공급자 심볼이 같거나 없으면 이름만 싣는다', () => {
        expect(
            resolvedInstrumentFields({
                symbol: 'AAPL',
                name: 'Apple Inc.',
                fmpSymbol: 'AAPL',
            })
        ).toEqual({ resolvedName: 'Apple Inc.' });
        expect(
            resolvedInstrumentFields({ symbol: 'AAPL', name: 'Apple Inc.' })
        ).toEqual({ resolvedName: 'Apple Inc.' });
    });

    it('조회가 저하됐으면(null) 아무것도 싣지 않는다', () => {
        expect(resolvedInstrumentFields(null)).toEqual({});
    });
});
