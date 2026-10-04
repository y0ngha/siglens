import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type MockInstance,
} from 'vitest';
import {
    HUMAN_INTERACTION_STORAGE_KEY,
    __resetHumanInteractionForTests,
    hasHumanInteracted,
    markHumanInteracted,
    subscribeHumanInteraction,
} from '../humanInteractionStore';

/**
 * jsdom 이벤트는 `isTrusted=false`이고 이 속성은 덮어쓸 수 없다(LegacyUnforgeable).
 * 그래서 스토어가 단 리스너를 스파이로 잡아 신뢰 이벤트 모양의 객체를 직접 넘긴다
 * (방문자 비콘 게이트 테스트와 같은 방식).
 */
let addSpy: MockInstance<typeof window.addEventListener>;

function dispatchTrusted(type: string): void {
    for (const [eventType, listener] of addSpy.mock.calls) {
        if (eventType !== type || typeof listener !== 'function') continue;
        listener({ type, isTrusted: true } as unknown as Event);
    }
}

describe('humanInteractionStore', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
        __resetHumanInteractionForTests();
        addSpy = vi.spyOn(window, 'addEventListener');
    });
    afterEach(() => {
        vi.restoreAllMocks();
        __resetHumanInteractionForTests();
    });

    it('입력 전에는 false다', () => {
        expect(hasHumanInteracted()).toBe(false);
    });

    it('스크립트가 보낸 이벤트(isTrusted=false)는 무시한다', () => {
        const onChange = vi.fn();
        subscribeHumanInteraction(onChange);
        window.dispatchEvent(new Event('pointerdown'));
        expect(hasHumanInteracted()).toBe(false);
        expect(onChange).not.toHaveBeenCalled();
    });

    it.each(['pointerdown', 'keydown', 'wheel', 'pointermove'])(
        '신뢰 %s 이벤트를 입력으로 인정하고 구독자에게 알린다',
        type => {
            const onChange = vi.fn();
            subscribeHumanInteraction(onChange);
            dispatchTrusted(type);
            expect(hasHumanInteracted()).toBe(true);
            expect(onChange).toHaveBeenCalledTimes(1);
            expect(
                window.sessionStorage.getItem(HUMAN_INTERACTION_STORAGE_KEY)
            ).toBe('1');
        }
    );

    it('scroll은 입력으로 인정하지 않는다(크롤러의 scrollTo로도 난다)', () => {
        subscribeHumanInteraction(vi.fn());
        dispatchTrusted('scroll');
        expect(hasHumanInteracted()).toBe(false);
    });

    it('같은 탭 세션의 이전 인정을 sessionStorage에서 복원한다', () => {
        window.sessionStorage.setItem(HUMAN_INTERACTION_STORAGE_KEY, '1');
        expect(hasHumanInteracted()).toBe(true);
    });

    it('저장소 쓰기가 막혀도 메모리 플래그는 남는다', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        markHumanInteracted();
        expect(hasHumanInteracted()).toBe(true);
    });

    it('인정 뒤에는 리스너를 뗀다', () => {
        const remove = vi.spyOn(window, 'removeEventListener');
        subscribeHumanInteraction(vi.fn());
        dispatchTrusted('pointerdown');
        expect(remove).toHaveBeenCalledWith(
            'pointermove',
            expect.any(Function),
            expect.objectContaining({ capture: true })
        );
    });

    it('구독자가 여럿이어도 리스너는 한 벌만 단다', () => {
        subscribeHumanInteraction(vi.fn());
        subscribeHumanInteraction(vi.fn());
        expect(
            addSpy.mock.calls.filter(([type]) => type === 'pointerdown')
        ).toHaveLength(1);
    });
});
