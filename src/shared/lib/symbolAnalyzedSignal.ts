/**
 * "종목 분석이 화면에 그려졌다" 신호. 차트 탭(`ChartContent`)이 분석 서사가 렌더된 순간
 * 발행하고, 루트 레이아웃의 넛지 호스트가 구독한다 — 호스트는 종목 페이지 트리 밖에 있어
 * props나 컨텍스트로 닿지 않는다(`analysisRateLimitSignal`과 같은 구조).
 */
type Listener = (symbol: string) => void;

const listeners = new Set<Listener>();

export function publishSymbolAnalyzed(symbol: string): void {
    listeners.forEach(listener => listener(symbol));
}

export function subscribeSymbolAnalyzed(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
