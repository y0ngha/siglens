import {
    findSpecByApiModelId,
    resolveMaxOutputTokens,
    toProviderTurns,
    toSdkTransportOptions,
} from '@/entities/llm-provider/lib/utils';
import type { ConversationTurn } from '@y0ngha/siglens-core';

describe('findSpecByApiModelId', () => {
    it('유효한 apiModelId로 일치하는 ModelSpec을 반환한다', () => {
        // MODEL_SPECS의 'claude-sonnet-5-5' 키는 apiModelId 'claude-sonnet-5-5'을 가진다.
        const result = findSpecByApiModelId('claude-sonnet-5-5');
        expect(result).toBeDefined();
        expect(result?.apiModelId).toBe('claude-sonnet-5-5');
    });

    it('존재하지 않는 apiModelId는 undefined를 반환한다', () => {
        const result = findSpecByApiModelId('non-existent-model-id');
        expect(result).toBeUndefined();
    });
});

describe('toProviderTurns', () => {
    describe('string contents', () => {
        it('문자열이면 단일 user 턴으로 반환한다', () => {
            const result = toProviderTurns('Hello');
            expect(result).toEqual([{ role: 'user', content: 'Hello' }]);
        });
    });

    describe('ConversationTurn[] contents', () => {
        it('빈 배열이면 빈 배열을 반환한다', () => {
            const result = toProviderTurns([]);
            expect(result).toEqual([]);
        });

        it('role이 user인 턴은 user로 그대로 매핑한다', () => {
            const contents: ConversationTurn[] = [{ role: 'user', text: 'Hi' }];
            const result = toProviderTurns(contents);
            expect(result).toEqual([{ role: 'user', content: 'Hi' }]);
        });

        it('role이 assistant인 턴은 assistant로 그대로 매핑한다', () => {
            const contents: ConversationTurn[] = [
                { role: 'assistant', text: 'Hello back' },
            ];
            const result = toProviderTurns(contents);
            expect(result).toEqual([
                { role: 'assistant', content: 'Hello back' },
            ]);
        });

        it('user/assistant 교대 히스토리를 순서대로 변환한다', () => {
            const contents: ConversationTurn[] = [
                { role: 'user', text: 'Q1' },
                { role: 'assistant', text: 'A1' },
                { role: 'user', text: 'Q2' },
            ];
            const result = toProviderTurns(contents);
            expect(result).toEqual([
                { role: 'user', content: 'Q1' },
                { role: 'assistant', content: 'A1' },
                { role: 'user', content: 'Q2' },
            ]);
        });
    });
});

describe('resolveMaxOutputTokens', () => {
    it('limits가 없으면 스펙 상한 그대로다', () => {
        expect(resolveMaxOutputTokens(1000, undefined)).toBe(1000);
    });

    it('호출자 상한이 더 작으면 그 값을 쓴다', () => {
        expect(resolveMaxOutputTokens(1000, { maxOutputTokens: 200 })).toBe(
            200
        );
    });

    it('호출자 상한이 스펙보다 커도 스펙 상한을 넘기지 않는다', () => {
        expect(resolveMaxOutputTokens(1000, { maxOutputTokens: 5000 })).toBe(
            1000
        );
    });
});

describe('toSdkTransportOptions', () => {
    it('limits가 없으면 빈 객체라 SDK 기본값이 유지된다', () => {
        expect(toSdkTransportOptions(undefined)).toEqual({});
    });

    it('지정한 필드만 싣는다', () => {
        expect(toSdkTransportOptions({ timeoutMs: 3000 })).toEqual({
            timeout: 3000,
        });
    });

    it('maxRetries 0도 그대로 싣는다(재시도 비활성)', () => {
        expect(toSdkTransportOptions({ maxRetries: 0 })).toEqual({
            maxRetries: 0,
        });
    });
});
