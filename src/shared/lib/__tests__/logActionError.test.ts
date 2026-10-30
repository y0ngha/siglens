import { describe, expect, it, vi } from 'vitest';
import { logActionError } from '@/shared/lib/logActionError';

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

    it('cause가 없으면 최상위 code를 남긴다', () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        try {
            const error = Object.assign(new Error('connect failed'), {
                code: 'ECONNRESET',
            });
            logActionError('[tag]', error);
            expect(errorSpy).toHaveBeenCalledWith('[tag]', {
                name: 'Error',
                code: 'ECONNRESET',
            });
        } finally {
            errorSpy.mockRestore();
        }
    });

    it('cause.code와 최상위 code가 모두 있으면 cause.code가 우선한다', () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        try {
            const error = Object.assign(new Error('wrapped'), {
                code: 'TOP',
                cause: { code: '23505' },
            });
            logActionError('[tag]', error);
            expect(errorSpy).toHaveBeenCalledWith('[tag]', {
                name: 'Error',
                code: '23505',
            });
        } finally {
            errorSpy.mockRestore();
        }
    });

    it('cause.code가 문자열이 아니면 최상위 문자열 code로 대체한다', () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        try {
            const error = Object.assign(new Error('wrapped'), {
                code: '08006',
                cause: { code: 42 },
            });
            logActionError('[tag]', error);
            expect(errorSpy).toHaveBeenCalledWith('[tag]', {
                name: 'Error',
                code: '08006',
            });
        } finally {
            errorSpy.mockRestore();
        }
    });

    it('문자열이 아닌 최상위 code는 버린다', () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        try {
            const error = Object.assign(new Error('bad'), {
                code: { secret: 'payload' },
            });
            logActionError('[tag]', error);
            expect(errorSpy).toHaveBeenCalledWith('[tag]', {
                name: 'Error',
                code: undefined,
            });
        } finally {
            errorSpy.mockRestore();
        }
    });

    it('최상위 code가 있어도 message는 로그에 포함하지 않는다', () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        try {
            const error = Object.assign(new Error('SECRET-bound-param'), {
                code: '23505',
            });
            logActionError('[tag]', error);
            expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(
                'SECRET-bound-param'
            );
        } finally {
            errorSpy.mockRestore();
        }
    });
});
