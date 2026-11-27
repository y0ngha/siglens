import { DrizzleQueryError } from 'drizzle-orm/errors';
import { describe, expect, it, vi } from 'vitest';

import { installConsoleDbErrorRedaction } from '@/shared/db/installConsoleDbErrorRedaction';

const SECRET = 'session-token-abc123';

function makeTarget() {
    const calls: Record<string, unknown[][]> = {};
    const target = {} as Console;
    for (const method of ['error', 'warn', 'log', 'info', 'debug'] as const) {
        calls[method] = [];
        target[method] = ((...args: unknown[]) => {
            calls[method].push(args);
        }) as Console[typeof method];
    }
    return { target, calls };
}

function makeDbError(): DrizzleQueryError {
    const cause = Object.assign(new Error(`bad ${SECRET}`), {
        name: 'PostgresError',
        code: '23505',
    });
    return new DrizzleQueryError(
        'select * from sessions where id = $1',
        [SECRET],
        cause
    );
}

/** Node가 에러를 출력할 때 쓰는 것과 같은 직렬화(메시지·스택·cause 포함). */
async function printed(args: unknown[]): Promise<string> {
    const { format, inspect } = await import('node:util');
    return `${format(...args)}\n${args.map(a => inspect(a, { depth: 10 })).join('\n')}`;
}

describe('installConsoleDbErrorRedaction', () => {
    it('console.error(DB 에러)가 파라미터를 메시지·cause·스택 어디에도 싣지 않는다', async () => {
        const { target, calls } = makeTarget();
        installConsoleDbErrorRedaction(target);

        const err = makeDbError();
        // 사전 조건: 원본은 실제로 새는 모양이다.
        expect(await printed([err])).toContain(SECRET);

        target.error(err);

        expect(calls.error).toHaveLength(1);
        const output = await printed(calls.error[0]);
        expect(output).not.toContain(SECRET);
        expect(output).not.toContain('Failed query');
        expect(output).toContain('code=23505');
    });

    it('Next가 붙이는 접두사 인자는 그대로 두고 에러 인자만 지운다', () => {
        const { target, calls } = makeTarget();
        installConsoleDbErrorRedaction(target);

        target.error('prefix', makeDbError(), 'tail');

        expect(calls.error[0][0]).toBe('prefix');
        expect(calls.error[0][2]).toBe('tail');
        expect(typeof calls.error[0][1]).toBe('string');
    });

    it('비DB 에러·문자열·객체는 같은 참조로 통과한다', () => {
        const { target, calls } = makeTarget();
        installConsoleDbErrorRedaction(target);

        const plain = new Error('provider timeout');
        const obj = { a: 1 };
        target.warn(plain, 'text', obj, 42, null, undefined);

        const args = calls.warn[0];
        expect(args[0]).toBe(plain);
        expect(args[1]).toBe('text');
        expect(args[2]).toBe(obj);
        expect(args.slice(3)).toEqual([42, null, undefined]);
    });

    it('error·warn·log·info·debug 다섯 메서드를 모두 감싼다', () => {
        const { target, calls } = makeTarget();
        installConsoleDbErrorRedaction(target);

        for (const method of [
            'error',
            'warn',
            'log',
            'info',
            'debug',
        ] as const) {
            target[method](makeDbError());
            expect(typeof calls[method][0][0]).toBe('string');
        }
    });

    it('두 번 설치해도 래퍼가 겹치지 않는다', () => {
        const { target, calls } = makeTarget();
        installConsoleDbErrorRedaction(target);
        const wrapped = target.error;
        installConsoleDbErrorRedaction(target);

        expect(target.error).toBe(wrapped);
        target.error('once');
        expect(calls.error).toEqual([['once']]);
    });

    it('원본 에러 객체는 건드리지 않는다(code 분기가 그대로 동작)', () => {
        const { target } = makeTarget();
        installConsoleDbErrorRedaction(target);

        const err = makeDbError();
        target.error(err);

        expect(err).toBeInstanceOf(DrizzleQueryError);
        expect((err.cause as { code?: string }).code).toBe('23505');
        expect(err.message).toContain(SECRET);
    });

    it('기본 대상은 전역 console이며 호출 시점에 원본을 부른다', () => {
        const methods = ['error', 'warn', 'log', 'info', 'debug'] as const;
        const consoleRecord = console as unknown as Record<symbol, unknown>;
        const marker = Symbol.for('siglens.consoleDbErrorRedactionInstalled');
        const hadMarker = Object.hasOwn(consoleRecord, marker);
        const savedMarker = consoleRecord[marker];
        const saved = methods.map(method => [method, console[method]] as const);
        const spy = vi.fn();
        delete consoleRecord[marker];
        console.error = spy;
        try {
            installConsoleDbErrorRedaction();
            console.error(makeDbError());
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy).toHaveBeenCalledWith(expect.any(String));
        } finally {
            for (const [method, fn] of saved) console[method] = fn;
            if (hadMarker) consoleRecord[marker] = savedMarker;
            else delete consoleRecord[marker];
        }
    });
});
