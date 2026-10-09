import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/shared/lib/funnel/trackFunnelEvent', () => ({
    trackFunnelEvent: track,
}));

import { useFunnelNudgeShown } from '@/shared/hooks/useFunnelNudgeShown';
import type { ContextOf } from '@/shared/lib/funnel/funnelEvents';

const shownCalls = () =>
    track.mock.calls.filter(([event]) => event === 'nudge_shown');

describe('useFunnelNudgeShown', () => {
    beforeEach(() => {
        track.mockReset();
    });

    it('마운트 시 nudge_shown을 한 번 보낸다', () => {
        renderHook(() => useFunnelNudgeShown({ kind: 'rate_limit' }));
        expect(shownCalls()).toEqual([['nudge_shown', { kind: 'rate_limit' }]]);
    });

    it('variant가 있으면 함께 보낸다', () => {
        renderHook(() =>
            useFunnelNudgeShown({ kind: 'anon_auto', variant: 'emailReport' })
        );
        expect(track).toHaveBeenCalledWith('nudge_shown', {
            kind: 'anon_auto',
            variant: 'emailReport',
        });
    });

    it('variant가 undefined면 키를 보내지 않는다', () => {
        renderHook(() =>
            useFunnelNudgeShown({ kind: 'model_gate', variant: undefined })
        );
        const [, context] = shownCalls().find(() => true)!;
        expect(context).toEqual({ kind: 'model_gate' });
        expect(Object.keys(context as object)).toEqual(['kind']);
    });

    it('같은 값으로 다시 렌더하면 다시 보내지 않는다 — idempotent open', () => {
        const { rerender } = renderHook(
            (ctx: ContextOf<'nudge_shown'>) => useFunnelNudgeShown(ctx),
            { initialProps: { kind: 'rate_limit' } }
        );
        rerender({ kind: 'rate_limit' });
        rerender({ kind: 'rate_limit' });
        expect(shownCalls()).toHaveLength(1);
    });

    it('열린 채 종류가 바뀌면 다른 넛지를 본 것이라 다시 보낸다', () => {
        const { rerender } = renderHook(
            (ctx: ContextOf<'nudge_shown'>) => useFunnelNudgeShown(ctx),
            {
                initialProps: {
                    kind: 'anon_auto',
                    variant: 'reasoning',
                } as ContextOf<'nudge_shown'>,
            }
        );
        rerender({ kind: 'anon_auto', variant: 'emailReport' });
        expect(shownCalls().map(([, ctx]) => ctx)).toEqual([
            { kind: 'anon_auto', variant: 'reasoning' },
            { kind: 'anon_auto', variant: 'emailReport' },
        ]);
    });
});
