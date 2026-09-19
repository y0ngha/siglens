import { afterEach, describe, expect, it, vi } from 'vitest';

import { logToolDegrade } from '@/app/api/ai/chat/tools/logToolDegrade';

describe('logToolDegrade', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('Error + cause.code(string)면 errorName/code를 그대로 로그한다', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const error = new Error('bound param: userId=u1 leaked in message');
        error.name = 'DrizzleQueryError';
        (error as Error & { cause?: { code: string } }).cause = {
            code: '23505',
        };

        logToolDegrade(
            'get_bars_indicators',
            'higher-timeframe bars fetch',
            error
        );

        expect(spy).toHaveBeenCalledWith(
            '[AgentTool]',
            'get_bars_indicators',
            'higher-timeframe bars fetch failed, degrading',
            { errorName: 'DrizzleQueryError', code: '23505' }
        );
    });

    it('non-Error를 throw해도 errorName은 "unknown"으로, code는 undefined로 degrade된다', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

        logToolDegrade(
            'get_cached_analysis',
            'quote lookup',
            'not an Error instance'
        );

        expect(spy).toHaveBeenCalledWith(
            '[AgentTool]',
            'get_cached_analysis',
            'quote lookup failed, degrading',
            { errorName: 'unknown', code: undefined }
        );
    });

    it('message는 절대 로그에 노출하지 않는다', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const error = new Error('bound param: userId=u1-secret leaked here');
        error.name = 'DrizzleQueryError';

        logToolDegrade('get_my_portfolio', 'quote lookup', error);

        const loggedArgs = spy.mock.calls.find(
            call => call[1] === 'get_my_portfolio'
        );
        expect(JSON.stringify(loggedArgs)).not.toContain('u1-secret');
    });
});
