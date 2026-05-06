'use client';

import type { ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import { NewsAiSummaryError } from '@/components/news/NewsAiSummaryError';

interface NewsAiSummaryErrorBoundaryProps {
    children: ReactNode;
}

export function NewsAiSummaryErrorBoundary({
    children,
}: NewsAiSummaryErrorBoundaryProps) {
    return (
        <ErrorBoundary FallbackComponent={NewsAiSummaryError}>
            {children}
        </ErrorBoundary>
    );
}
