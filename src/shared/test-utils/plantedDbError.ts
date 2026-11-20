import { inspect } from 'node:util';

import { expect, type MockInstance } from 'vitest';

/**
 * 로그 누출 시험용 DB 에러. drizzle-orm 0.45의 `DrizzleQueryError`처럼 메시지에 바인딩 파라미터가 들어가고,
 * `cause`에 드라이버 SQLSTATE가 있다. 값은 전부 가짜다(`SERVER.md#SA-26`).
 */
export const PLANTED_TOKEN = 'tok_FAKE_planted_123';
export const PLANTED_EMAIL = 'fake.person@example.invalid';

export function plantedDbError(): Error {
    return new Error(
        `Failed query: select "id" from "sessions" where "token" = $1 and "email" = $2\nparams: ${PLANTED_TOKEN},${PLANTED_EMAIL}`,
        { cause: Object.assign(new Error('driver'), { code: '57014' }) }
    );
}

/**
 * 스파이가 한 번 이상 불렸고, 그 인자에 심어 둔 값·메시지가 한 글자도 없다. 호출 인자 전체를 깊게 펼쳐
 * (`cause`·스택 포함) 본다 — `JSON.stringify`는 Error를 `{}`로 만들어 누출을 못 본다.
 * 고정 접두사는 호출자가 따로 단언한다.
 */
export function expectLogWithoutPlantedSecrets(spy: MockInstance): void {
    expect(spy).toHaveBeenCalled();
    const text = inspect(spy.mock.calls, { depth: 10, maxStringLength: null });
    expect(text).not.toContain(PLANTED_TOKEN);
    expect(text).not.toContain(PLANTED_EMAIL);
    expect(text).not.toContain('Failed query');
}
