'use client';

import { useEffect, useState } from 'react';
import { submitNewsAnalysisAction } from '@/infrastructure/market/submitNewsAnalysisAction';
import { pollNewsAnalysisAction } from '@/infrastructure/market/pollNewsAnalysisAction';
import type { NewsAnalysisResponse, ModelId } from '@y0ngha/siglens-core';

const POLL_INTERVAL_MS = 2500;

type NewsAnalysisState =
    | { status: 'idle' | 'submitting' | 'polling' }
    | { status: 'done'; result: NewsAnalysisResponse }
    | { status: 'error'; error: string };

export function useNewsAnalysis(
    symbol: string,
    modelId: ModelId
): NewsAnalysisState {
    const [state, setState] = useState<NewsAnalysisState>({ status: 'idle' });

    useEffect(() => {
        let alive = true;
        let pollHandle: ReturnType<typeof setTimeout> | null = null;

        async function run(): Promise<void> {
            setState({ status: 'submitting' });

            const submitted = await submitNewsAnalysisAction(symbol, modelId);

            if (!alive) return;

            if (submitted.status === 'cached') {
                setState({ status: 'done', result: submitted.result });
                return;
            }

            if (submitted.status === 'error') {
                const errorMsg =
                    submitted.code === 'no_news'
                        ? '분석할 뉴스가 없습니다. 잠시 후 다시 시도해 주세요.'
                        : '사용량 한도를 초과했습니다.';
                setState({ status: 'error', error: errorMsg });
                return;
            }

            // status === 'submitted' — start polling
            const { jobId } = submitted;
            setState({ status: 'polling' });

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
                        error: polled.error ?? '분석 중 오류가 발생했습니다.',
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
