'use client';

import dynamic from 'next/dynamic';

// 공지 팝업은 부가 기능이라 SSR이 불필요하다. ssr:false로 client-only lazy 마운트하면
// 페이지 hydration 완료 후에 마운트되어, streaming 라우트(예: not-found shell)의
// hydration과 경쟁하지 않는다(E2E race 해소).
const NoticePopup = dynamic(
    () => import('./NoticePopup').then(m => m.NoticePopup),
    { ssr: false }
);

export function NoticePopupLoader() {
    return <NoticePopup />;
}
