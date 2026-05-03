'use client';

import { useEffect, useState } from 'react';
import { submitNewsAnalysisAction } from '@/infrastructure/market/submitNewsAnalysisAction';
import { pollNewsAnalysisAction } from '@/infrastructure/market/pollNewsAnalysisAction';
import type { NewsAnalysisResponse, ModelId } from '@y0ngha/siglens-core';

/** Polling interval for in-flight news analysis jobs (ms). */
const POLL_INTERVAL_MS = 3000;

type NewsAugmentState =
    | { status: 'loading' | 'idle' }
    | { status: 'done'; result: NewsAnalysisResponse }
    | { status: 'error'; error: string };

// Returns `{ status: 'idle' }` for the no-news case so callers can omit the augment silently.
export function useNewsAugment(
    symbol: string,
    modelId: ModelId
): NewsAugmentState {
    const [state, setState] = useState<NewsAugmentState>({
        status: 'loading',
    });

    useEffect(() => {
        let alive = true;
        let pollHandle: ReturnType<typeof setTimeout> | null = null;

        async function run(): Promise<void> {
            // Reset on symbol/modelId change so the previous symbol's 'done' state isn't shown.
            setState({ status: 'loading' });
            const submitted = await submitNewsAnalysisAction(symbol, modelId);
            if (!alive) return;

            if (submitted.status === 'cached') {
                setState({ status: 'done', result: submitted.result });
                return;
            }

            if (submitted.status === 'error') {
                if (submitted.code === 'no_news') {
                    // Graceful: no recent news — hide augment section silently.
                    setState({ status: 'idle' });
                    return;
                }
                setState({
                    status: 'error',
                    error:
                        typeof submitted.error === 'string'
                            ? submitted.error
                            : '뉴스 분석 요청 중 오류가 발생했습니다.',
                });
                return;
            }

            // status === 'submitted' — start polling
            const { jobId } = submitted;

            const poll = async (): Promise<void> => {
                const polled = await pollNewsAnalysisAction(jobId);
                if (!alive) return;

                if (polled.status === 'processing') {
                    pollHandle = setTimeout(() => {
                        void poll();
                    }, POLL_INTERVAL_MS);
                } else if (polled.status === 'done') {
                    setState({ status: 'done', result: polled.result });
                } else {
                    setState({
                        status: 'error',
                        error:
                            polled.error ?? '뉴스 분석 중 오류가 발생했습니다.',
                    });
                }
            };

            void poll();
        }

        void run();

        return () => {
            alive = false;
            if (pollHandle !== null) clearTimeout(pollHandle);
        };
    }, [symbol, modelId]);

    return state;
}
