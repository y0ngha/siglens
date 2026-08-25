'use client';

import { useEffect } from 'react';
import { applyStoredTheme } from '@/shared/lib/theme';

/**
 * `<head>`의 테마 스크립트가 닿지 않는 렌더 경로를 메운다.
 *
 * 동적 세그먼트에서 `notFound()`를 부르면 Next는 루트 레이아웃을 거치지 않는
 * 에러 셸(`<html id="__next_error__">`)을 내보낸다. 그 셸의 `<head>`에는
 * 인라인 스크립트가 **하나도 없고**, 본문은 통째로 클라이언트 렌더다 —
 * 그래서 라이트를 고른 사용자가 어두운 404를 봤다(`data-theme`이 아예 안 찍힌다).
 * 스크립트를 `not-found.tsx`에 넣어도 그 셸에서는 실행되지 않는다.
 *
 * 이 셸은 어차피 하이드레이션 전까지 빈 화면이라 효과에서 찍어도 깜빡임이
 * 늘지 않는다. 레이아웃을 거치는 404에서는 스크립트가 이미 같은 값을
 * 찍어둔 뒤라 무해하다.
 */
export function ThemeAttributeFallback() {
    useEffect(() => {
        applyStoredTheme();
    }, []);
    return null;
}
