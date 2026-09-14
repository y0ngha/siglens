import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getAssetInfo } = vi.hoisted(() => ({ getAssetInfo: vi.fn() }));
vi.mock('@/entities/ticker/lib/getAssetInfo', () => ({ getAssetInfo }));

import { resolveAssetInfoOrNull } from '@/app/api/ai/chat/tools/resolveAssetInfo';

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
        // `logToolError` in `tools/index.ts` for the same privacy rule).
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
