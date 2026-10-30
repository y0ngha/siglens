import { classifySaveApiKeyError } from '@/entities/api-key/lib/saveApiKeyError';

describe('classifySaveApiKeyError', () => {
    it('암호화 키 env 오류 메시지는 server_misconfigured로 분류한다', () => {
        expect(
            classifySaveApiKeyError(
                new Error(
                    'LLM_API_KEY_ENCRYPTION_KEY environment variable is required for user API key encryption'
                )
            )
        ).toBe('server_misconfigured');
    });

    it('5자리 SQLSTATE code를 가진 Error는 storage_unavailable로 분류한다', () => {
        expect(
            classifySaveApiKeyError(
                Object.assign(new Error('connection failure'), {
                    code: '08006',
                })
            )
        ).toBe('storage_unavailable');
    });

    it('Drizzle이 감싼 오류는 cause의 SQLSTATE code로 storage_unavailable로 분류한다', () => {
        expect(
            classifySaveApiKeyError(
                new Error('Failed query: insert into ...', {
                    cause: { code: '08006' },
                })
            )
        ).toBe('storage_unavailable');
    });

    it('cause의 code가 SQLSTATE가 아니면 unknown으로 분류한다', () => {
        expect(
            classifySaveApiKeyError(
                new Error('x', { cause: { code: '08o06' } })
            )
        ).toBe('unknown');
    });

    it('SQLSTATE가 아닌 code를 가진 Error는 unknown으로 분류한다', () => {
        expect(
            classifySaveApiKeyError(
                Object.assign(new Error('x'), { code: 'ECONNRESET' })
            )
        ).toBe('unknown');
    });

    it('문자열이 아닌 code를 가진 Error는 unknown으로 분류한다', () => {
        expect(
            classifySaveApiKeyError(
                Object.assign(new Error('x'), { code: 12345 })
            )
        ).toBe('unknown');
    });

    it('code가 없는 일반 Error는 unknown으로 분류한다', () => {
        expect(classifySaveApiKeyError(new Error('boom'))).toBe('unknown');
    });

    it('Error가 아닌 던져진 값은 unknown으로 분류한다', () => {
        expect(classifySaveApiKeyError({ code: '23505' })).toBe('unknown');
    });
});
