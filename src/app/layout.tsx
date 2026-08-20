import type { ReactNode } from 'react';

/**
 * 패스스루 루트 레이아웃.
 *
 * `<html>`·`<body>`는 `[locale]/layout.tsx`가 렌더한다 — `lang`이 로케일에 따라
 * 달라져야 하는데 루트는 로케일을 모르기 때문이다.
 *
 * 그럼에도 이 파일이 필요한 이유: Next는 `src/app/not-found.tsx`(매칭 실패 URL의
 * 404) 위에 루트 레이아웃을 요구한다. 없으면 그 라우트가 구성되지 않는다.
 *
 * ⚠️ 이 파일은 `notFound()` 404의 빈 본문 문제를 **해결하지 않는다** — 실측으로
 * 확인했다. 그건 별개의 알려진 한계이고 근거는 `[locale]/not-found.tsx` 참고.
 */
export default function RootLayout({
    children,
}: {
    readonly children: ReactNode;
}) {
    return children;
}
