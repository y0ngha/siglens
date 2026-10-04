'use client';

import { useEffect, useRef } from 'react';
import { ensureNewsCardsAnalyzedAction } from '@/entities/news-article/actions/ensureNewsCardsAnalyzedAction';

/**
 * 마운트/종목 변경 시 fresh news fetch + card analysis를 fire-and-forget로 트리거한다.
 *
 * 봇은 JS를 실행하지 않아 이 트리거를 자연히 건너뛴다(skipAnalysis 옵션 불필요).
 * 처리한 symbol을 ref에 저장해, StrictMode 이중 마운트는 막되 (언마운트 없이) 종목이
 * 바뀌면 새 symbol에 대해 다시 트리거한다(boolean ref는 종목 변경을 놓침).
 *
 * fire-and-forget UI 트리거를 훅으로 분리해 NewsAiSummary 뷰는 렌더에만 집중하고,
 * 트리거 동작은 격리 테스트한다.
 *
 * `enabled`가 `false`인 동안은 트리거하지 않는다 — 큐레이션 밖 종목의 첫 신뢰 입력
 * 전(`useAiAutoRunAllowed`). "봇은 JS를 실행하지 않는다"는 위 전제는 렌더형 크롤러에는
 * 맞지 않았다. 이미 분석된 기사 카드는 DB에서 읽히므로 미뤄도 표시에는 영향이 없고,
 * `enabled`가 참이 되는 순간 그 종목에 대해 한 번 트리거한다.
 */
export function useNewsAnalysisTrigger(symbol: string, enabled = true): void {
    const triggeredSymbolRef = useRef<string | null>(null);
    useEffect(() => {
        if (!enabled) return;
        if (triggeredSymbolRef.current === symbol) return;
        triggeredSymbolRef.current = symbol;
        void ensureNewsCardsAnalyzedAction(symbol).catch((e: unknown) => {
            console.error(
                '[useNewsAnalysisTrigger] ensureNewsCardsAnalyzedAction failed:',
                e
            );
        });
    }, [symbol, enabled]);
}
