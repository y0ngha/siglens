import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * 로케일을 인지하는 navigation API.
 *
 * 앱 코드는 `next/link` / `next/navigation` 대신 여기서 나온 것을 쓴다 —
 * 그래야 `/en/AAPL`에서 누른 링크가 `/en/...`으로 유지된다. 기본 API를 그대로
 * 쓰면 로케일이 조용히 ko로 떨어진다.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
    createNavigation(routing);
