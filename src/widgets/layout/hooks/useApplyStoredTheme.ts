'use client';

import { useEffect } from 'react';
import { applyStoredTheme } from '@/shared/lib/theme';

/**
 * 마운트 때 저장된 테마를 문서에 적용한다.
 *
 * **에러 셸의 테마를 메운다.** 동적 세그먼트에서 `notFound()`를 부르면 Next는 루트 레이아웃을
 * 거치지 않는 `<html id="__next_error__">` 셸을 내보낸다. 그 `<head>`에는 인라인 스크립트가
 * 없어 `data-theme`이 안 찍히고, 라이트를 고른 사용자가 어두운 404를 본다.
 *
 * 전용 컴포넌트가 아니라 문의 다이얼로그가 이 훅을 쓰는 이유: not-found 경계에 모듈이 하나
 * 추가되면 번들러가 그 경계가 끌고 오는 홈 위젯 묶음을 두 벌로 갈라 내보내 홈 first-load가
 * 약 17KB 늘었다. 이미 그 경계에 있는 클라이언트 컴포넌트에 얹으면 모듈이 늘지 않아 비용이
 * 수백 바이트로 떨어진다. 다른 라우트에서는 `<head>` 스크립트가 이미 같은 값을 찍어 둔 뒤라 무해하다.
 */
export function useApplyStoredTheme(): void {
    useEffect(() => {
        applyStoredTheme();
    }, []);
}
