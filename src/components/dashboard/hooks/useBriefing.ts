'use client';

import { useEffect, useState } from 'react';
import { pollBriefingAction } from '@/infrastructure/market/pollBriefingAction';
import { sleep } from '../utils/sleep';

const POLL_INTERVAL_MS = 5000;

interface UseBriefingResult {
    briefing: string | null;
    isLoading: boolean;
    error: string | null;
}

export function useBriefing(
    jobId: string | undefined,
    initialBriefing: string | undefined
): UseBriefingResult {
    const [briefing, setBriefing] = useState<string | null>(
        initialBriefing ?? null
    );
    const [isLoading, setIsLoading] = useState(
        jobId !== undefined && initialBriefing === undefined
    );
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!jobId) return;

        let cancelled = false;

        void (async () => {
            while (!cancelled) {
                await sleep(POLL_INTERVAL_MS);
                if (cancelled) break;

                try {
                    const result = await pollBriefingAction(jobId);
                    if (cancelled) break;

                    if (result.status === 'done') {
                        setBriefing(result.briefing);
                        setIsLoading(false);
                        return;
                    }
                    if (result.status === 'error') {
                        setError(result.error);
                        setIsLoading(false);
                        return;
                    }
                    // 'processing' → 계속 폴링
                } catch {
                    if (cancelled) break;
                    setError('브리핑 조회에 실패했습니다.');
                    setIsLoading(false);
                    return;
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [jobId]);

    return { briefing, isLoading, error };
}
