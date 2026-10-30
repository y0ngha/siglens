'use client';

import { useCallback, useState } from 'react';

/** `usePasswordConfirmation`이 재설정 폼에 돌려주는 입력값·불일치 상태·핸들러. */
export interface PasswordConfirmation {
    password: string;
    confirmPassword: string;
    /** 마지막 제출에서 두 칸이 달랐고, 그 뒤로 어느 칸도 고치지 않았다. */
    isMismatch: boolean;
    changePassword: (value: string) => void;
    changeConfirmPassword: (value: string) => void;
    /** 두 칸이 같을 때만 `formAction`으로 넘기는 `<form action>` 핸들러. */
    submit: (formData: FormData) => void;
}

/**
 * 새 비밀번호·확인 칸의 제어 상태와 일치 검사를 묶는다.
 *
 * 불일치는 클라이언트에서 막는다 — 서버 액션은 확인 칸을 받지 않는다.
 * 불일치 표시는 어느 칸이든 다시 고치는 순간 지운다.
 */
export function usePasswordConfirmation(
    formAction: (formData: FormData) => void
): PasswordConfirmation {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isMismatch, setIsMismatch] = useState(false);

    const changePassword = useCallback((value: string): void => {
        setPassword(value);
        setIsMismatch(false);
    }, []);

    const changeConfirmPassword = useCallback((value: string): void => {
        setConfirmPassword(value);
        setIsMismatch(false);
    }, []);

    const submit = useCallback(
        (formData: FormData): void => {
            if (password !== confirmPassword) {
                setIsMismatch(true);
                return;
            }
            setIsMismatch(false);
            // 여기서 입력을 비우지 않는다. 성공하면 액션이 리디렉트하므로 비울
            // 필요가 없고, 실패하면(약한 비밀번호·같은 비밀번호·만료 토큰) 빈 칸
            // 아래에 오류만 남아 전부 다시 타이핑해야 한다. 강도 체크리스트도
            // 함께 초기화돼 무엇이 모자랐는지조차 사라진다.
            formAction(formData);
        },
        [password, confirmPassword, formAction]
    );

    return {
        password,
        confirmPassword,
        isMismatch,
        changePassword,
        changeConfirmPassword,
        submit,
    };
}
