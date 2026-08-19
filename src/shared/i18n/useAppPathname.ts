'use client';

import { usePathname } from 'next/navigation';
import { splitLocalePath } from './locales';

/**
 * **로케일 접두사를 뗀** 현재 경로.
 *
 * `usePathname()`은 `/en/AAPL/news`를 그대로 준다. 반면 앱 안의 경로 상수·패턴은
 * 전부 접두사가 없다(`NAV_TREE`의 href, `notices.path_pattern`, 심볼 탭 href,
 * `derivePageContextLabel`의 앵커드 정규식). 그래서 **비교·매칭에 쓰는 경로는
 * 반드시 이 훅으로 받아야 한다** — 아니면 비-ko 사용자에게서 그 기능이 조용히
 * 전부 꺼진다(활성 탭 표시, 경로 지정 공지, 챗 페이지 컨텍스트 라벨이 실제로 그랬다).
 *
 * ⚠️ **이동에 재사용하는 경로에는 쓰지 말 것.** `router.replace(pathname + '?x=1')`
 * 처럼 현재 경로를 그대로 다시 밟는 코드는 접두사가 **있어야** 한다
 * (`useQueryParamState`, `useSectorSignalState`). 그런 곳은 `usePathname()`을 직접 쓴다.
 */
export function useAppPathname(): string {
    return splitLocalePath(usePathname()).path;
}
