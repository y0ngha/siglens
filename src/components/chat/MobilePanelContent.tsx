'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import type { AnalysisResponse, Timeframe } from '@/domain/types';
import { ChatPanel } from '@/components/chat/ChatPanel';

interface MobilePanelContentProps {
    analysisContent: ReactNode;
    symbol: string;
    timeframe: Timeframe;
    analysis: AnalysisResponse;
    isAnalysisReady: boolean;
}

export function MobilePanelContent({
    analysisContent,
    symbol,
    timeframe,
    analysis,
    isAnalysisReady,
}: MobilePanelContentProps) {
    const [view, setView] = useState<'analysis' | 'chat'>('analysis');

    if (view === 'chat') {
        return (
            <div className="flex flex-col">
                <button
                    type="button"
                    onClick={() => setView('analysis')}
                    className="text-primary-400 hover:text-primary-300 mb-3 flex items-center gap-1 self-start text-sm"
                >
                    ← 분석으로
                </button>
                <ChatPanel
                    symbol={symbol}
                    timeframe={timeframe}
                    analysis={analysis}
                    isAnalysisReady={isAnalysisReady}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col">
            {analysisContent}
            <div className="mt-4">
                <button
                    type="button"
                    onClick={() => setView('chat')}
                    disabled={!isAnalysisReady}
                    className="bg-secondary-700/50 hover:bg-secondary-700 border-secondary-600 disabled:text-secondary-500 w-full rounded-lg border py-2.5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed"
                >
                    💬 AI에게 물어보기
                </button>
            </div>
        </div>
    );
}
