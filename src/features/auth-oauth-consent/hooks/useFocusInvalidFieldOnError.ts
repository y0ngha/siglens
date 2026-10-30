'use client';

import { useEffect, useRef, type RefObject } from 'react';
import type { FinalizeOAuthSignupState } from '@/shared/lib/auth/formTypes';

/** `ConsentCheckboxGroup`이 동의하지 않은 필수 항목에 다는 오류 표식. */
const INVALID_FIELD_SELECTOR = '[aria-invalid="true"]';

/**
 * 액션이 오류를 돌려줄 때마다 폼의 첫 오류 항목(동의하지 않은 첫 필수 약관)으로
 * 포커스를 옮긴다.
 *
 * 제출 버튼은 전송 중 `disabled`가 되므로 쥐고 있던 포커스를 잃는다. 그대로 두면
 * 키보드·스크린리더 사용자는 어느 항목이 빠졌는지 찾아 거슬러 올라가야 한다. 오류
 * 항목으로 옮기면 그 체크박스의 `aria-describedby` 오류 문구가 함께 읽힌다.
 *
 * 마운트 이후 `error`의 **참조**가 바뀔 때만 동작하고, 마운트 시점에는 옮기지
 * 않는다. 마지막으로 처리한 오류를 ref에 두고 마운트 시점의 `error`로 초기화하므로,
 * 오류를 이미 실은 채로 마운트된 폼(캐시에서 복원된 상태 등)은 포커스를 가져가지
 * 않는다. 호출자는 제출마다 새 `error` 객체를 넘겨야 한다(`useActionState`는
 * 제출마다 새 상태를 돌려준다). 그래야 같은 오류가 반복돼도 다시 옮기고, 체크박스
 * 토글 같은 무관한 리렌더에는 포커스를 뺏지 않는다. 오류가 왔어도 표식이 붙은
 * 항목이 없으면(모두 동의된 상태) 포커스를 그대로 둔다.
 */
export function useFocusInvalidFieldOnError(
    formRef: RefObject<HTMLFormElement | null>,
    error: FinalizeOAuthSignupState['error']
): void {
    const handledErrorRef = useRef(error);

    useEffect(() => {
        if (error === handledErrorRef.current) return;
        handledErrorRef.current = error;
        if (!error) return;
        formRef.current
            ?.querySelector<HTMLElement>(INVALID_FIELD_SELECTOR)
            ?.focus();
    }, [formRef, error]);
}
