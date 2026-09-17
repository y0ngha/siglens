'use client';

import dynamic from 'next/dynamic';
import { useDeferredReveal } from '../hooks/useDeferredReveal';

// 공지 팝업은 부가 기능이라 SSR이 불필요하다. ssr:false로 client-only lazy 마운트하면
// 페이지 hydration 완료 후에 마운트되어, streaming 라우트(예: not-found shell)의
// hydration과 경쟁하지 않는다(E2E race 해소).
const NoticePopup = dynamic(
    () => import('./NoticePopup').then(m => m.NoticePopup),
    { ssr: false }
);

/**
 * 노출 지연은 팝업이 아니라 **여기서** 건다. 팝업 컴포넌트 자체는 "띄울 공지가 있으면
 * 띄운다"는 계약을 그대로 유지하고(큐·dismiss 동작 불변), 언제 띄울지만 로더가 정한다.
 * 공지 청크 다운로드도 그만큼 미뤄진다.
 */
export function NoticePopupLoader() {
    const revealed = useDeferredReveal();
    if (!revealed) return null;
    return <NoticePopup />;
}
