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
 * **쓰는 법: 차트를 렌더하는 곳에서 `key={themeVersion}`을 준다.**
 * `chartThemeRemountGuard`가 그 규약을 강제한다.
 *
 * **차트 생성 효과의 deps에 넣지 말 것.** 한 번 그렇게 했는데, 차트는 다시
 * 만들어지지만 `setData`를 부르는 효과와 오버레이 훅 31개는 안정적인 ref에만
 * 의존해 재실행되지 않아 **토글 한 번에 차트가 영구히 백지가 됐다**(감사 실증:
 * createChart 2회 대 setData 1회, 캔들·거래량·축이 전부 사라지고 새로고침해야
 * 복구). 부분만 다시 만들면 안 된다 — `key`로 갈아 그 훅들이 전부 함께 돌게 한다.
 *
 * 대가: 토글 순간 줌·스크롤 위치가 초기화된다. 로드 경로에서는 이 값이 0에서
 * 변하지 않으므로 remount가 없다. 위치가 한 번 초기화되는 것과 차트가 안
 * 보이는 것 중에는 전자가 낫다.
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
