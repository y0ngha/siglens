'use client';

/**
 * @file 로그인 실패 직후 비밀번호 입력으로 포커스를 돌려주는 훅.
 */

import { useEffect, useRef, type RefObject } from 'react';
import type { LoginFormState } from '@/shared/lib/auth/formTypes';
import { LOGIN_FIELD } from '../lib/loginFields';

/**
 * 비밀번호를 다시 치라는 신호가 아닌 오류. 한도에 걸린 사용자에게 입력칸 포커스는 도움이 되지 않고
 * 배너 안내(재설정 링크 포함)를 읽는 데 방해만 된다.
 */
const NON_FIELD_ERROR_CODES: ReadonlySet<string> = new Set([
    'rate_limited',
    'too_many_login_attempts',
]);

/**
 * 액션이 오류 상태를 돌려줄 때마다 폼의 비밀번호 입력에 포커스를 둔다.
 * 돌려받은 ref는 `<form ref>`에 단다.
 *
 * 제출 중에는 버튼이 `disabled`라 포커스가 버튼을 떠나고, React 19의 제출 후
 * 폼 리셋이 비밀번호를 비운다. 그대로 두면 키보드 사용자는 다시 칠 칸을 찾아
 * 처음부터 Tab을 눌러야 한다. 상태 객체가 액션마다 새로 만들어지므로 같은
 * 오류가 연달아 나도 매번 다시 옮긴다. 마운트 시의 초기 오류(`?error=`)는
 * 액션 상태가 아니라 포커스를 빼앗지 않는다.
 *
 * 한도 오류(`rate_limited`·`too_many_login_attempts`)는 비밀번호 칸의 문제가
 * 아니라서 포커스를 옮기지 않는다.
 */
export function useLoginErrorFocus(
    state: LoginFormState
): RefObject<HTMLFormElement | null> {
    const formRef = useRef<HTMLFormElement>(null);
    useEffect(() => {
        if (!state.error || NON_FIELD_ERROR_CODES.has(state.error.code)) return;
        const field = formRef.current?.elements.namedItem(LOGIN_FIELD.password);
        if (field instanceof HTMLInputElement) field.focus();
    }, [state]);
    return formRef;
}
