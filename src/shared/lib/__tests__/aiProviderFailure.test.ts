import { describe, expect, it } from 'vitest';
import * as Anthropic from '@anthropic-ai/sdk';
import { ApiError as GeminiApiError } from '@google/genai';
import * as OpenAI from 'openai';
import {
    caughtAnalysisErrorCode,
    isAiProviderFailure,
    providerFailureStatus,
} from '@/shared/lib/aiProviderFailure';
import { FmpHttpError } from '@/shared/api/fmp/FmpHttpError';

/**
 * 픽스처는 손으로 만든 `{ status }` 객체가 아니라 **실제 SDK 에러 클래스**다.
 * 판정이 SDK 인스턴스의 모양(`status`+`headers` own property, Gemini의 `name`)에
 * 기대므로, 손 픽스처로는 SDK 버전이 바뀌어 모양이 달라져도 테스트가 초록으로 남는다.
 */
const HEADERS = new Headers();

describe('isAiProviderFailure — provider 장애(참)', () => {
    it.each([500, 502, 503])('OpenAI/DeepSeek SDK status %i', status => {
        expect(
            isAiProviderFailure(
                new OpenAI.APIError(status, undefined, 'boom', HEADERS)
            )
        ).toBe(true);
    });

    it('OpenAI/DeepSeek SDK 429', () => {
        expect(
            isAiProviderFailure(
                new OpenAI.RateLimitError(429, undefined, 'slow', HEADERS)
            )
        ).toBe(true);
    });

    it.each([500, 503, 429])('Anthropic SDK status %i', status => {
        expect(
            isAiProviderFailure(
                new Anthropic.APIError(status, undefined, 'boom', HEADERS)
            )
        ).toBe(true);
    });

    it.each([500, 503, 429])('Gemini SDK ApiError status %i', status => {
        expect(
            isAiProviderFailure(new GeminiApiError({ message: 'x', status }))
        ).toBe(true);
    });

    it('SDK 연결 실패(status 없음)', () => {
        expect(
            isAiProviderFailure(
                new OpenAI.APIConnectionError({ message: 'Connection error.' })
            )
        ).toBe(true);
        expect(
            isAiProviderFailure(
                new Anthropic.APIConnectionError({ message: undefined })
            )
        ).toBe(true);
    });

    it('SDK 타임아웃', () => {
        expect(
            isAiProviderFailure(new OpenAI.APIConnectionTimeoutError())
        ).toBe(true);
    });

    it('core 재시도 소진 sentinel', () => {
        expect(isAiProviderFailure(new Error('AI_SERVER_UNSTABLE'))).toBe(true);
    });

    it('core 1.7.0 DEEPSEEK_STALLED 코드', () => {
        const stalled = Object.assign(new Error('DeepSeek stream stalled'), {
            code: 'DEEPSEEK_STALLED',
        });
        expect(isAiProviderFailure(stalled)).toBe(true);
    });
});

describe('isAiProviderFailure — provider 장애 아님(거짓)', () => {
    it('400 요청 오류', () => {
        expect(
            isAiProviderFailure(
                new OpenAI.BadRequestError(400, undefined, 'bad', HEADERS)
            )
        ).toBe(false);
        expect(
            isAiProviderFailure(
                new GeminiApiError({ message: 'x', status: 400 })
            )
        ).toBe(false);
    });

    it('BYOK 키의 401/403', () => {
        expect(
            isAiProviderFailure(
                new OpenAI.AuthenticationError(401, undefined, 'key', HEADERS)
            )
        ).toBe(false);
        expect(
            isAiProviderFailure(
                new Anthropic.PermissionDeniedError(
                    403,
                    undefined,
                    'key',
                    HEADERS
                )
            )
        ).toBe(false);
    });

    it('사용량 한도 등 SDK 밖의 에러', () => {
        expect(
            isAiProviderFailure(
                new Error('Daily analysis usage limit exceeded.')
            )
        ).toBe(false);
    });

    it('FMP 5xx는 status가 있어도 AI 장애가 아니다', () => {
        expect(isAiProviderFailure(new FmpHttpError('/quote', 503, null))).toBe(
            false
        );
    });

    it('SDK가 감싸지 않은 fetch 실패는 출처를 알 수 없어 거짓', () => {
        expect(isAiProviderFailure(new TypeError('fetch failed'))).toBe(false);
    });

    it('에러가 아닌 값', () => {
        expect(isAiProviderFailure('AI_SERVER_UNSTABLE')).toBe(false);
        expect(isAiProviderFailure(null)).toBe(false);
    });
});

describe('caughtAnalysisErrorCode', () => {
    it('provider 장애 → ai_server_unstable, 그 밖 → unexpected_error', () => {
        expect(caughtAnalysisErrorCode(new Error('AI_SERVER_UNSTABLE'))).toBe(
            'ai_server_unstable'
        );
        expect(caughtAnalysisErrorCode(new Error('db down'))).toBe(
            'unexpected_error'
        );
    });
});

describe('providerFailureStatus — 사용자 키 호출의 거절·실패 (공개 API)', () => {
    it.each([
        [
            'Anthropic 401',
            new Anthropic.AuthenticationError(401, undefined, 'bad', HEADERS),
            401,
        ],
        [
            'Anthropic 429',
            new Anthropic.RateLimitError(429, undefined, 'slow', HEADERS),
            429,
        ],
        [
            'OpenAI 403',
            new OpenAI.PermissionDeniedError(403, undefined, 'no', HEADERS),
            403,
        ],
        [
            'OpenAI 400',
            new OpenAI.BadRequestError(400, undefined, 'bad req', HEADERS),
            400,
        ],
        [
            'OpenAI 503',
            new OpenAI.APIError(503, undefined, 'down', HEADERS),
            503,
        ],
        [
            'Gemini 401',
            new GeminiApiError({ message: 'API key not valid', status: 401 }),
            401,
        ],
    ])('%s → 상태를 그대로 돌려준다', (_label, error, status) => {
        expect(providerFailureStatus(error)).toEqual({ status });
    });

    it('연결 실패·타임아웃은 status가 없어 null', () => {
        expect(
            providerFailureStatus(
                new OpenAI.APIConnectionError({ message: 'socket hang up' })
            )
        ).toEqual({ status: null });
    });

    it('core 재시도 소진 sentinel·DeepSeek 정지는 원본 상태를 모르므로 null', () => {
        expect(providerFailureStatus(new Error('AI_SERVER_UNSTABLE'))).toEqual({
            status: null,
        });
        expect(
            providerFailureStatus(
                Object.assign(new Error('stalled'), {
                    code: 'DEEPSEEK_STALLED',
                })
            )
        ).toEqual({ status: null });
    });

    it('provider 탓이 아닌 오류(FMP·일반 Error·값)는 null 자체', () => {
        expect(
            providerFailureStatus(new FmpHttpError('/quote', 503, null))
        ).toBeNull();
        expect(providerFailureStatus(new Error('db down'))).toBeNull();
        expect(providerFailureStatus(new TypeError('fetch failed'))).toBeNull();
        expect(providerFailureStatus('AI_SERVER_UNSTABLE')).toBeNull();
        expect(providerFailureStatus(null)).toBeNull();
    });
});
