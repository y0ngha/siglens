import { describe, expect, it, vi } from 'vitest';
import { logActionError } from '@/entities/chat-conversation/lib/logActionError';

describe('logActionError', () => {
    it('Error 이름과 cause.code만 남기고 message는 포함하지 않는다', () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        try {
            const error = Object.assign(
                new Error("Failed query: ... title = '민감정보' ..."),
                { name: 'DrizzleQueryError', cause: { code: '23505' } }
            );
            logActionError('[tag]', error);
            expect(errorSpy).toHaveBeenCalledWith('[tag]', {
                name: 'DrizzleQueryError',
                code: '23505',
            });
        } finally {
            errorSpy.mockRestore();
        }
    });

    it('Error가 아닌 값은 name을 unknown으로 남긴다', () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        try {
            logActionError('[tag]', 'not-an-error');
            expect(errorSpy).toHaveBeenCalledWith('[tag]', {
                name: 'unknown',
                code: undefined,
            });
        } finally {
            errorSpy.mockRestore();
        }
    });
});
