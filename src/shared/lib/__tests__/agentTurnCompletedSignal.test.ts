import {
    publishAgentTurnCompleted,
    subscribeAgentTurnCompleted,
} from '@/shared/lib/agentTurnCompletedSignal';

describe('agentTurnCompletedSignal', () => {
    it('구독자 모두에게 발행을 전달한다', () => {
        const first = vi.fn();
        const second = vi.fn();
        const offFirst = subscribeAgentTurnCompleted(first);
        const offSecond = subscribeAgentTurnCompleted(second);

        publishAgentTurnCompleted();
        offFirst();
        offSecond();

        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
    });

    it('구독을 해제한 리스너는 다음 발행을 받지 않는다', () => {
        const removed = vi.fn();
        const kept = vi.fn();
        const offRemoved = subscribeAgentTurnCompleted(removed);
        const offKept = subscribeAgentTurnCompleted(kept);

        offRemoved();
        publishAgentTurnCompleted();
        offKept();

        expect(removed).not.toHaveBeenCalled();
        expect(kept).toHaveBeenCalledTimes(1);
    });

    it('구독자가 없으면 발행해도 아무 일도 없다', () => {
        expect(() => publishAgentTurnCompleted()).not.toThrow();
    });
});
