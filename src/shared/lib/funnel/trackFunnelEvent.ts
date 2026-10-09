import { postBeacon } from '@/shared/lib/beacon';
import type { ContextOf, FunnelEvent } from './funnelEvents';
import { rememberLastGate } from './lastGate';

/**
 * 수집 라우트. `presence` 하위인 이유는 `src/app/api/presence/route.ts` 모듈 주석 참고 —
 * `analytics`·`track`·`collect`가 든 경로는 EasyList 계열 차단 목록이 막는다.
 */
export const FUNNEL_EVENT_ENDPOINT = '/api/presence/funnel';

/**
 * 가입 퍼널 이벤트 하나를 보낸다. 한 요청에 이벤트 하나 — 묶음 전송은 만들지 않는다
 * (사건이 드물고, 묶으면 `keepalive` 전송이 커진다).
 *
 * 어떤 실패도 던지지 않는다. SSR에서 불리면 no-op. `nudge_shown`(회원용 `member_*` 제외)·`gate_clicked`는
 * "비회원이 마지막으로 누른 것"으로 `lastGate`에도 남긴다 — 가입 완료 이벤트가 붙인다.
 * 봇 필터는 서버의 `isBot`이 맡는다(Playwright·헤드리스 UA는 거기서 204).
 */
export function trackFunnelEvent<E extends FunnelEvent>(
    event: E,
    context: ContextOf<E>
): void {
    if (typeof window === 'undefined') return;
    try {
        if (event === 'nudge_shown') {
            const { kind } = context as ContextOf<'nudge_shown'>;
            // 방침이 고지한 것은 "가입 전 마지막으로 본 것"이다 — 회원 넛지는 남기지 않는다.
            if (!kind.startsWith('member_')) rememberLastGate(kind);
        } else if (event === 'gate_clicked') {
            rememberLastGate((context as ContextOf<'gate_clicked'>).gate);
        }
        postBeacon({ url: FUNNEL_EVENT_ENDPOINT, body: { event, context } });
    } catch {
        // 측정 실패가 화면을 깨뜨리면 안 된다.
    }
}
