/**
 * Unit tests for the seed-crypto-korean-names translate→upsert mapping.
 *
 * Imports the REAL exported helpers from the seed script (extractKoreanName,
 * buildUpsertValues, toUpsertRow) rather than re-implementing them locally, so a
 * drift in production logic fails these tests. The script's run() entry point is
 * guarded (executedDirectly), so importing here does not connect to the DB or
 * Gemini; env vars are validated inside run(), not at module load.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { InlinedResponse } from '@google/genai';
import {
    extractKoreanName,
    buildUpsertValues,
    toUpsertRow,
} from '../seed-crypto-korean-names';

/** Build a minimal InlinedResponse with the given metadata.id and text body. */
function makeResponse(id: string, text: string): InlinedResponse {
    return {
        metadata: { id },
        response: {
            candidates: [{ content: { parts: [{ text }] } }],
        },
    } as unknown as InlinedResponse;
}

/** Build a JSON body of the shape the prompt requests: { SYMBOL: koreanName }. */
function jsonBody(symbol: string, koreanName: string): string {
    return JSON.stringify({ [symbol]: koreanName });
}

describe('seed-crypto-korean-names — extractKoreanName', () => {
    it('잘 형성된 JSON 응답에서 Korean 이름을 추출한다', () => {
        expect(
            extractKoreanName('BTCUSD', jsonBody('BTCUSD', '비트코인'))
        ).toBe('비트코인');
    });

    it('이더리움 번역도 올바르게 추출한다', () => {
        expect(
            extractKoreanName('ETHUSD', jsonBody('ETHUSD', '이더리움'))
        ).toBe('이더리움');
    });

    it('다른 symbol 키를 가진 응답은 null을 반환한다', () => {
        expect(
            extractKoreanName('BTCUSD', jsonBody('ETHUSD', '이더리움'))
        ).toBeNull();
    });

    it('빈 문자열 값은 null을 반환한다', () => {
        expect(extractKoreanName('BTCUSD', jsonBody('BTCUSD', ''))).toBeNull();
    });

    it('공백만 있는 값은 null을 반환한다', () => {
        expect(
            extractKoreanName('BTCUSD', jsonBody('BTCUSD', '   '))
        ).toBeNull();
    });

    it('값을 trim 한다', () => {
        expect(
            extractKoreanName('BTCUSD', jsonBody('BTCUSD', '  비트코인  '))
        ).toBe('비트코인');
    });

    it('malformed JSON 은 null을 반환한다', () => {
        expect(extractKoreanName('BTCUSD', 'not json')).toBeNull();
    });

    it('배열 응답은 null을 반환한다', () => {
        expect(extractKoreanName('BTCUSD', '["비트코인"]')).toBeNull();
    });

    it('문자열이 아닌 값(숫자)은 null을 반환한다', () => {
        expect(extractKoreanName('BTCUSD', '{"BTCUSD":123}')).toBeNull();
    });
});

describe('seed-crypto-korean-names — buildUpsertValues', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        // The mapper logs warnings for skipped coins; silence to keep test output clean.
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        warnSpy.mockRestore();
    });

    it('id 기반으로 응답을 매칭해 upsert 값을 만든다', () => {
        const chunk = [
            { id: 'BTCUSD', prompt: 'p1' },
            { id: 'ETHUSD', prompt: 'p2' },
        ];
        const responses = [
            // Intentionally out of order to prove id-based (not index-based) matching.
            makeResponse('ETHUSD', jsonBody('ETHUSD', '이더리움')),
            makeResponse('BTCUSD', jsonBody('BTCUSD', '비트코인')),
        ];

        const { values, skipped } = buildUpsertValues(chunk, responses);

        expect(skipped).toBe(0);
        expect(values).toEqual([
            { symbol: 'BTCUSD', koreanName: '비트코인' },
            { symbol: 'ETHUSD', koreanName: '이더리움' },
        ]);
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('응답이 없는 coin 은 skip 한다', () => {
        const chunk = [
            { id: 'BTCUSD', prompt: 'p1' },
            { id: 'MISSING', prompt: 'p2' },
        ];
        const responses = [
            makeResponse('BTCUSD', jsonBody('BTCUSD', '비트코인')),
        ];

        const { values, skipped } = buildUpsertValues(chunk, responses);

        expect(values).toEqual([{ symbol: 'BTCUSD', koreanName: '비트코인' }]);
        expect(skipped).toBe(1);
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                '[MISSING] skipped — no matching response found'
            )
        );
    });

    it('error 가 있는 응답은 skip 한다', () => {
        const chunk = [{ id: 'BTCUSD', prompt: 'p1' }];
        const errored = {
            metadata: { id: 'BTCUSD' },
            error: { message: 'quota exceeded' },
        } as unknown as InlinedResponse;

        const { values, skipped } = buildUpsertValues(chunk, [errored]);

        expect(values).toEqual([]);
        expect(skipped).toBe(1);
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                '[BTCUSD] skipped — response error: quota exceeded'
            )
        );
    });

    it('빈 텍스트 응답은 skip 한다', () => {
        const chunk = [{ id: 'BTCUSD', prompt: 'p1' }];
        const responses = [makeResponse('BTCUSD', '')];

        const { values, skipped } = buildUpsertValues(chunk, responses);

        expect(values).toEqual([]);
        expect(skipped).toBe(1);
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('[BTCUSD] skipped — empty response text')
        );
    });

    it('malformed JSON 응답은 skip 한다', () => {
        const chunk = [{ id: 'BTCUSD', prompt: 'p1' }];
        const responses = [makeResponse('BTCUSD', 'not json')];

        const { values, skipped } = buildUpsertValues(chunk, responses);

        expect(values).toEqual([]);
        expect(skipped).toBe(1);
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                '[BTCUSD] skipped — could not extract Korean name from response'
            )
        );
    });

    it('Gemini 응답 키 대소문자가 달라도 올바르게 매칭한다', () => {
        const chunk = [{ id: 'BTCUSD', prompt: 'p1' }];
        // Gemini returns lowercase key in metadata.id — must still match BTCUSD.
        const lowercaseIdResponse = {
            metadata: { id: 'btcusd' },
            response: {
                candidates: [
                    {
                        content: {
                            parts: [{ text: jsonBody('BTCUSD', '비트코인') }],
                        },
                    },
                ],
            },
        } as unknown as InlinedResponse;

        const { values, skipped } = buildUpsertValues(chunk, [
            lowercaseIdResponse,
        ]);

        expect(skipped).toBe(0);
        expect(values).toEqual([{ symbol: 'BTCUSD', koreanName: '비트코인' }]);
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('metadata.id 가 없는 응답은 매칭에서 제외된다', () => {
        const chunk = [{ id: 'BTCUSD', prompt: 'p1' }];
        const noId = {
            response: {
                candidates: [
                    {
                        content: {
                            parts: [{ text: jsonBody('BTCUSD', '비트코인') }],
                        },
                    },
                ],
            },
        } as unknown as InlinedResponse;

        const { values, skipped } = buildUpsertValues(chunk, [noId]);

        // The response has no id to correlate, so the chunk's coin finds no match.
        expect(values).toEqual([]);
        expect(skipped).toBe(1);
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                '[warn] response missing metadata.id — skipped (cannot correlate to request)'
            )
        );
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                '[BTCUSD] skipped — no matching response found'
            )
        );
    });
});

describe('seed-crypto-korean-names — toUpsertRow', () => {
    it('name 플레이스홀더로 symbol 을 사용한다 (UPDATE 경로에서 미사용)', () => {
        // The placeholder name must equal the symbol; it is never persisted because
        // onConflictDoUpdate only sets korean_name on the always-taken UPDATE path.
        expect(
            toUpsertRow({ symbol: 'BTCUSD', koreanName: '비트코인' })
        ).toEqual({
            symbol: 'BTCUSD',
            name: 'BTCUSD',
            koreanName: '비트코인',
        });
    });
});
