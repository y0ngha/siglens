'use client';

import { useEffect } from 'react';
import type { CancelJobEntry } from '@/shared/lib/types';
import { CANCEL_JOBS_API_PATH } from '@/shared/lib/cancelJobsApi';

/**
 * pagehide 이벤트(탭 닫기·새로고침·뒤로가기 등 모든 언로드)에서 분석 job을 cancel한다.
 * Server Action은 언로드 후 완료가 보장되지 않으므로 sendBeacon을 사용한다.
 *
 * @param getJobs - 언로드 시 취소할 job 목록을 반환하는 콜백. null이면 no-op.
 *   콜백 내에서 ref를 null로 초기화해 unmount cleanup과의 이중 cancel을 방지한다.
 *   useCallback(fn, [])으로 감싸 안정적인 참조를 전달해야 한다.
 */
export function usePageHideCancel(
    getJobs: () => CancelJobEntry[] | null
): void {
    useEffect(() => {
        function handlePageHide() {
            const jobs = getJobs();
            if (!jobs || jobs.length === 0) return;
            navigator.sendBeacon(
                CANCEL_JOBS_API_PATH,
                new Blob([JSON.stringify({ jobs })], {
                    type: 'application/json',
                })
            );
        }
        window.addEventListener('pagehide', handlePageHide);
        return () => window.removeEventListener('pagehide', handlePageHide);
    }, [getJobs]);
}
