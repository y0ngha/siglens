// @vitest-environment jsdom
import { useMemo } from 'react';
import { render, screen } from '@testing-library/react';
import {
    SymbolChatProvider,
    type SymbolChatState,
} from '@/features/symbol-chat/model/SymbolChatContext';
import {
    usePublishSymbolChat,
    useSymbolChat,
} from '@/features/symbol-chat/hooks/useSymbolChat';

/**
 * Regression guard for the publish render loop.
 *
 * The analysis hooks (`useFinancialsAnalysis`, `useOptionsAnalysis`, …) return a
 * **fresh object every render**, and each widget derives its chat state with
 * `useMemo(() => buildChatState(state), [state])` — which therefore also mints a
 * fresh object every render. `publish` dedupes with `===`, so that new identity
 * always gets through and calls `setState` on the provider.
 *
 * That is harmless only as long as publishers do not subscribe to the state they
 * write. When `usePublishSymbolChat` read the combined context, one publish
 * re-rendered the publisher → new state object → publish → … until React aborted
 * with "Maximum update depth exceeded" (measured at 400+ renders). The fix is the
 * dispatch-only context; this test fails loudly if anyone merges the two again.
 *
 * The bug was masked in production because the 5 affected tabs unmounted their
 * widget whenever an SEO snapshot existed — the same gate that locked the chat.
 * Mounting those widgets (the point of this change) removes the mask, so this
 * guard has to hold.
 */

const RENDER_BUDGET = 25;

function LoopingPublisher() {
    // 렌더 횟수를 세는 것이 이 테스트의 목적이라 렌더 중 카운터 증가가 불가피하다.
    // (react-hooks/globals는 렌더를 순수하게 유지하라는 규칙 — 여기서는 그 순수성이
    // 깨졌는지를 측정하는 계측기 자체다.)
    // eslint-disable-next-line react-hooks/globals
    renderCount += 1;
    if (renderCount > RENDER_BUDGET) {
        throw new Error(`render loop: exceeded ${RENDER_BUDGET} renders`);
    }

    // Mirrors the real hooks: a brand-new object identity on every render.
    // 이 불안정성이 재현하려는 조건 자체다. exhaustive-deps는 useMemo 호출이
    // 아니라 **불안정한 값의 선언 위치**에 보고하므로 disable도 여기 붙는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const analysisState = { status: 'done' as const, result: { value: 1 } };
    const chatState = useMemo<SymbolChatState>(
        () => ({
            context: {
                kind: 'financials',
                payload: analysisState.result,
            } as unknown as SymbolChatState['context'],
            timeframe: null,
            isAnalysisReady: true,
        }),
        [analysisState]
    );

    usePublishSymbolChat(chatState);
    return null;
}

function ChatStateProbe() {
    const { isAnalysisReady } = useSymbolChat();
    return <span data-testid="ready">{String(isAnalysisReady)}</span>;
}

let renderCount = 0;

describe('SymbolChat publish loop', () => {
    beforeEach(() => {
        renderCount = 0;
    });

    it('settles instead of looping when a publisher republishes a fresh object', () => {
        render(
            <SymbolChatProvider>
                <LoopingPublisher />
                <ChatStateProbe />
            </SymbolChatProvider>
        );

        expect(renderCount).toBeLessThanOrEqual(RENDER_BUDGET);
        // 그리고 실제로 publish가 도달해야 한다 — 루프만 안 돌고 값이 안 실리면 무의미.
        expect(screen.getByTestId('ready').textContent).toBe('true');
    });
});
