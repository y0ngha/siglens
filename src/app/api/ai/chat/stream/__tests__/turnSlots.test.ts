import { afterEach, describe, expect, it } from 'vitest';
import {
    getActiveAgentTurns,
    hasFreeTurnSlot,
    MAX_CONCURRENT_AGENT_TURNS,
    reserveTurnSlot,
} from '@/app/api/ai/chat/stream/_lib/turnSlots';

describe('turnSlots', () => {
    // 반납 함수는 멱등이라, 중간 expect가 실패해 남은 슬롯도 여기서 정리해 다음 테스트로 새지 않게 한다.
    const reserved: Array<() => void> = [];
    const reserve = (): (() => void) => {
        const release = reserveTurnSlot();
        reserved.push(release);
        return release;
    };
    afterEach(() => {
        reserved.splice(0).forEach(release => release());
    });

    // 용량 정책 값이라 의도적으로 리터럴로 고정한다 — 바꾸려면 이 줄도 함께 바꿔야 한다.
    it('인스턴스당 동시 턴 상한은 4', () => {
        expect(MAX_CONCURRENT_AGENT_TURNS).toBe(4);
    });

    it('상한까지 예약하면 빈 슬롯이 없고, 반납하면 다시 생긴다', () => {
        const releases = Array.from(
            { length: MAX_CONCURRENT_AGENT_TURNS },
            reserve
        );
        expect(hasFreeTurnSlot()).toBe(false);
        expect(getActiveAgentTurns()).toBe(MAX_CONCURRENT_AGENT_TURNS);
        releases[0]();
        expect(hasFreeTurnSlot()).toBe(true);
        releases.slice(1).forEach(release => release());
        expect(getActiveAgentTurns()).toBe(0);
    });

    it('같은 반납 함수를 여러 번 불러도 한 번만 줄어든다', () => {
        const release = reserve();
        release();
        release();
        expect(getActiveAgentTurns()).toBe(0);
    });
});
