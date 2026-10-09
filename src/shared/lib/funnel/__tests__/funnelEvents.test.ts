import { describe, expect, it } from 'vitest';
import {
    FUNNEL_BODY_MAX_BYTES,
    FUNNEL_EVENTS,
    FUNNEL_GATES,
    FUNNEL_LAST_GATES,
    FUNNEL_NUDGE_CTAS,
    FUNNEL_NUDGE_KINDS,
    FUNNEL_NUDGE_VARIANTS,
    isFunnelEventPayload,
    REPORT_ENABLED_SOURCES,
    SIGNUP_METHODS,
    WATCHLIST_MERGE_MAX,
    WATCHLIST_SOURCES,
} from '@/shared/lib/funnel/funnelEvents';

describe('카탈로그 상수', () => {
    it('스펙 §3.3의 이벤트 7종을 전부 가진다', () => {
        expect([...FUNNEL_EVENTS].toSorted()).toEqual([
            'gate_clicked',
            'nudge_clicked',
            'nudge_shown',
            'report_enabled',
            'signup_completed',
            'watchlist_added',
            'watchlist_merged',
        ]);
    });

    it('lastGate 후보는 게이트와 넛지 종류의 합집합이다', () => {
        expect(FUNNEL_LAST_GATES).toEqual([
            ...FUNNEL_GATES,
            ...FUNNEL_NUDGE_KINDS,
        ]);
    });

    it('본문 상한은 1KB다', () => {
        expect(FUNNEL_BODY_MAX_BYTES).toBe(1024);
    });
});

describe('isFunnelEventPayload — 양성', () => {
    it.each(FUNNEL_NUDGE_KINDS)('nudge_shown kind=%s', kind => {
        expect(
            isFunnelEventPayload({ event: 'nudge_shown', context: { kind } })
        ).toBe(true);
    });

    it.each(FUNNEL_NUDGE_VARIANTS)(
        'anon_auto는 variant=%s를 허용한다',
        variant => {
            expect(
                isFunnelEventPayload({
                    event: 'nudge_shown',
                    context: { kind: 'anon_auto', variant },
                })
            ).toBe(true);
        }
    );

    it.each(FUNNEL_NUDGE_CTAS)('nudge_clicked cta=%s', cta => {
        expect(
            isFunnelEventPayload({
                event: 'nudge_clicked',
                context: { kind: 'rate_limit', cta },
            })
        ).toBe(true);
    });

    it.each(FUNNEL_GATES)('gate_clicked gate=%s', gate => {
        expect(
            isFunnelEventPayload({ event: 'gate_clicked', context: { gate } })
        ).toBe(true);
    });

    it.each(SIGNUP_METHODS)(
        'signup_completed method=%s, lastGate=null',
        method => {
            expect(
                isFunnelEventPayload({
                    event: 'signup_completed',
                    context: { method, lastGate: null },
                })
            ).toBe(true);
        }
    );

    it.each(FUNNEL_LAST_GATES)('signup_completed lastGate=%s', lastGate => {
        expect(
            isFunnelEventPayload({
                event: 'signup_completed',
                context: { method: 'email', lastGate },
            })
        ).toBe(true);
    });

    it.each(WATCHLIST_SOURCES)('watchlist_added source=%s', source => {
        expect(
            isFunnelEventPayload({
                event: 'watchlist_added',
                context: { source },
            })
        ).toBe(true);
    });

    it.each([0, 1, WATCHLIST_MERGE_MAX])('watchlist_merged count=%d', count => {
        expect(
            isFunnelEventPayload({
                event: 'watchlist_merged',
                context: { count },
            })
        ).toBe(true);
    });

    it.each(REPORT_ENABLED_SOURCES)('report_enabled source=%s', source => {
        expect(
            isFunnelEventPayload({
                event: 'report_enabled',
                context: { source },
            })
        ).toBe(true);
    });
});

describe('isFunnelEventPayload — 음성', () => {
    it.each([null, 'x', 1, [], undefined])('객체가 아니면 거부: %p', value => {
        expect(isFunnelEventPayload(value)).toBe(false);
    });

    it('모르는 event를 거부한다', () => {
        expect(isFunnelEventPayload({ event: 'page_view', context: {} })).toBe(
            false
        );
    });

    it('최상위 여분 키를 거부한다', () => {
        expect(
            isFunnelEventPayload({
                event: 'gate_clicked',
                context: { gate: 'timeframe' },
                url: '/AAPL',
            })
        ).toBe(false);
    });

    it('context 여분 키를 거부한다 — 자유 텍스트가 섞일 통로다', () => {
        expect(
            isFunnelEventPayload({
                event: 'gate_clicked',
                context: { gate: 'timeframe', query: 'nvda' },
            })
        ).toBe(false);
    });

    it('context가 배열이면 거부한다', () => {
        expect(
            isFunnelEventPayload({ event: 'gate_clicked', context: [] })
        ).toBe(false);
    });

    it('잘못된 enum 값을 거부한다', () => {
        expect(
            isFunnelEventPayload({
                event: 'gate_clicked',
                context: { gate: 'chat' },
            })
        ).toBe(false);
        expect(
            isFunnelEventPayload({
                event: 'nudge_clicked',
                context: { kind: 'rate_limit', cta: 'buy' },
            })
        ).toBe(false);
    });

    it('anon_auto가 아닌 kind에 variant가 붙으면 거부한다', () => {
        expect(
            isFunnelEventPayload({
                event: 'nudge_shown',
                context: { kind: 'rate_limit', variant: 'reasoning' },
            })
        ).toBe(false);
    });

    it('signup_completed는 lastGate 키가 없으면 거부한다', () => {
        expect(
            isFunnelEventPayload({
                event: 'signup_completed',
                context: { method: 'email' },
            })
        ).toBe(false);
    });

    it.each([-1, 1.5, WATCHLIST_MERGE_MAX + 1, '3'])(
        'watchlist_merged count=%p를 거부한다',
        count => {
            expect(
                isFunnelEventPayload({
                    event: 'watchlist_merged',
                    context: { count },
                })
            ).toBe(false);
        }
    );
});
