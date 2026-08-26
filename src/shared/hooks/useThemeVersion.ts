'use client';

import { useEffect, useState } from 'react';
import { THEME_CHANGE_EVENT } from '@/shared/lib/theme';

/**
 * 테마가 바뀔 때마다 증가하는 카운터.
 *
 * 왜 필요한가: 차트 색은 `CHART_COLORS` 게터가 **접근 시점에** 고르지만,
 * lightweight-charts 시리즈는 생성될 때 받은 색을 그대로 들고 있다. 첫 로드는
 * 인라인 스크립트가 페인트 전에 `data-theme`을 찍으므로 언제나 정확하고,
 * 문제는 세션 중 토글이다 — 라이트로 바꿔도 차트만 다크 팔레트로 남는다.
 *
 * 이 값을 차트 **생성 효과의 deps**에 넣으면 토글 시 차트가 다시 만들어지며
 * 새 팔레트를 읽는다. 지표 오버레이 훅 31개를 각각 배선하는 대신 생성 지점
 * 4곳만 건드리는 선택이다.
 *
 * 대가: 토글 순간 줌·스크롤 위치가 초기화된다. 원래 주석은 "리마운트 금지"였고
 * 그건 **페이지 로드** 경로를 지키기 위한 것이었다 — 거기서는 여전히 유효하다
 * (이 카운터는 로드 시 0에서 변하지 않는다). 사용자가 직접 누른 토글에서
 * 위치가 한 번 초기화되는 것과, 차트가 읽히지 않는 것 중에는 전자가 낫다.
 */
export function useThemeVersion(): number {
    const [version, setVersion] = useState(0);

    useEffect(() => {
        const bump = () => setVersion(v => v + 1);
        window.addEventListener(THEME_CHANGE_EVENT, bump);
        return () => window.removeEventListener(THEME_CHANGE_EVENT, bump);
    }, []);

    return version;
}
