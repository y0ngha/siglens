'use client';

import { useEffect, useState } from 'react';
import { submitFundamentalAnalysisAction } from '@/infrastructure/market/submitFundamentalAnalysisAction';
import { pollFundamentalAnalysisAction } from '@/infrastructure/market/pollFundamentalAnalysisAction';
import type {
    FundamentalAnalysisResponse,
    ModelId,
} from '@y0ngha/siglens-core';

const POLL_INTERVAL_MS = 2500;

type FundamentalAnalysisState =
    | { status: 'idle' | 'submitting' | 'polling' }
    | { status: 'done'; result: FundamentalAnalysisResponse }
    | { status: 'error'; error: string };

export function useFundamentalAnalysis(
    symbol: string,
    modelId: ModelId
): FundamentalAnalysisState {
    const [state, setState] = useState<FundamentalAnalysisState>({
        status: 'idle',
    });

    useEffect(() => {
        let alive = true;
        let pollHandle: ReturnType<typeof setTimeout> | null = null;

        async function run(): Promise<void> {
            setState({ status: 'submitting' });

            const submitted = await submitFundamentalAnalysisAction(
                symbol,
                modelId
            );

            if (!alive) return;

            if (submitted.status === 'cached') {
                setState({ status: 'done', result: submitted.result });
                return;
            }

            if (submitted.status === 'error') {
                const errorMsg =
                    submitted.code === 'fetch_failed'
                        ? (submitted.error ?? '데이터를 불러오지 못했습니다.')
                        : '사용량 한도를 초과했습니다.';
                setState({ status: 'error', error: errorMsg });
                return;
            }

            // status === 'submitted' — start polling
            const { jobId } = submitted;
            setState({ status: 'polling' });

            const poll = async (): Promise<void> => {
                const polled = await pollFundamentalAnalysisAction(jobId);
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
