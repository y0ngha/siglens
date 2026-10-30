import { describe, expect, it } from 'vitest';
import { TIER_CONFIG } from '@y0ngha/siglens-core';
import type { StreamErrorMessages } from '@/shared/lib/sse/runAnalysisStream';
import {
    FREE_LOCKED_INFO_DEPTH,
    cooldownKeyOf,
    rethrowStreamError,
    toAnalysisOutcome,
    type RunAnalysisActionResult,
} from '../../utils/analysisStream';

const MESSAGES = {
    keyRequired: 'msg:keyRequired',
    generic: 'msg:generic',
    unexpected: 'msg:unexpected',
    unstable: 'msg:unstable',
} as unknown as StreamErrorMessages;

describe('toAnalysisOutcome', () => {
    it.each(['cached', 'done', 'miss_no_trigger'] as const)(
        '%s 결과는 그대로 돌려준다',
        status => {
            const result = { status } as unknown as RunAnalysisActionResult;
            expect(toAnalysisOutcome(result, MESSAGES)).toBe(result);
        }
    );

    it('reanalyze_cooldown 결과는 그대로 돌려준다', () => {
        const result: RunAnalysisActionResult = {
            status: 'reanalyze_cooldown',
            remainingMs: 1_234,
        };
        expect(toAnalysisOutcome(result, MESSAGES)).toBe(result);
    });

    it('key_error는 카탈로그 문구로 던진다(core의 한국어 문구를 쓰지 않는다)', () => {
        const result = {
            status: 'key_error',
            error: 'core 원문',
        } as unknown as RunAnalysisActionResult;
        expect(() => toAnalysisOutcome(result, MESSAGES)).toThrow(
            'msg:keyRequired'
        );
    });

    it('error 객체에 message가 있으면 그 문구로 던진다', () => {
        const result = {
            status: 'error',
            error: { message: 'gate:locale-message' },
        } as unknown as RunAnalysisActionResult;
        expect(() => toAnalysisOutcome(result, MESSAGES)).toThrow(
            'gate:locale-message'
        );
    });

    it('error가 원시 문자열이면 일반 문구로 던진다', () => {
        const result = {
            status: 'error',
            error: 'Profile not found for symbol: AAPL',
        } as unknown as RunAnalysisActionResult;
        expect(() => toAnalysisOutcome(result, MESSAGES)).toThrow(
            'msg:generic'
        );
    });

    it('알 수 없는 상태는 unexpected 문구로 던진다', () => {
        const result = {
            status: 'weird',
        } as unknown as RunAnalysisActionResult;
        expect(() => toAnalysisOutcome(result, MESSAGES)).toThrow(
            'msg:unexpected'
        );
    });
});

describe('rethrowStreamError', () => {
    it('재시도 소진 sentinel은 unstable 문구로 바꾼다', () => {
        expect(() =>
            rethrowStreamError(new Error('AI_SERVER_UNSTABLE'), MESSAGES)
        ).toThrow('msg:unstable');
    });

    it('그 밖의 오류는 같은 객체를 다시 던진다', () => {
        const err = new Error('network');
        expect(() => rethrowStreamError(err, MESSAGES)).toThrow(err);
    });
});

describe('FREE_LOCKED_INFO_DEPTH', () => {
    it('free가 허용하는 depth는 하나도 담지 않는다', () => {
        expect(
            FREE_LOCKED_INFO_DEPTH.filter(depth =>
                TIER_CONFIG.infoDepth.free.includes(depth)
            )
        ).toEqual([]);
    });

    it('free 허용분과 합치면 전체 depth 집합이 된다', () => {
        const all = new Set(Object.values(TIER_CONFIG.infoDepth).flat());
        expect(
            new Set([...FREE_LOCKED_INFO_DEPTH, ...TIER_CONFIG.infoDepth.free])
        ).toEqual(all);
    });
});

describe('cooldownKeyOf', () => {
    it('symbol과 timeframe을 `|`로 잇는다', () => {
        expect(cooldownKeyOf('AAPL', '1Day')).toBe('AAPL|1Day');
    });
});
