vi.mock('@/entities/feedback/actions/submitVocFeedbackAction', () => ({
    submitVocFeedbackAction: vi.fn(),
}));

import { act, render, screen } from '@testing-library/react';
import type { VocTrigger } from '@/entities/feedback/types';
import { publishAgentTurnCompleted } from '@/shared/lib/agentTurnCompletedSignal';
import {
    LOCAL_STORAGE_VOC_PROMPT_STATE_KEY,
    SESSION_STORAGE_NUDGE_SHOWN_KEY,
} from '@/shared/lib/storageKeys';
import {
    VOC_PROMPT_COOLDOWN_MS,
    VOC_PROMPT_POLICY,
    type VocPromptSurface,
} from '@/shared/lib/vocPromptStorage';
import { hasNudgeShownThisSession } from '@/shared/lib/nudgeSession';
import {
    publishSymbolAnalyzed,
    subscribeSymbolAnalyzed,
} from '@/shared/lib/symbolAnalyzedSignal';
import {
    VOC_PROMPT_DELAY_MS,
    VOC_PROMPT_SETTLE_MS,
    VOC_PROMPT_TYPING_RETRIES,
    VOC_PROMPT_TYPING_RETRY_MS,
    VocPromptHost,
} from '../ui/VocPromptHost';

const dialog = () => screen.queryByRole('dialog');
const ANALYSIS_DELAY_MS = VOC_PROMPT_DELAY_MS.analysis;
const CHAT_DELAY_MS = VOC_PROMPT_DELAY_MS.agent_chat;

interface StoredState {
    uses: number;
    seen: string[];
    days: string[];
    promptCount: number;
    lastPromptedAt: number;
    submitted: boolean;
}

function seedState(overrides: Partial<StoredState>) {
    localStorage.setItem(
        LOCAL_STORAGE_VOC_PROMPT_STATE_KEY,
        JSON.stringify({
            uses: 0,
            seen: [],
            days: [],
            promptCount: 0,
            lastPromptedAt: 0,
            submitted: false,
            ...overrides,
        })
    );
}

/** 이용 한 번만 더하면 물어볼 때가 되는 방문자 - 아래 테스트의 다음 신호가 그 한 번이다. */
function seedOneUseShort() {
    seedState({ uses: 2, seen: ['SEEN1', 'SEEN2'] });
}

function storedState(): StoredState {
    return JSON.parse(
        localStorage.getItem(LOCAL_STORAGE_VOC_PROMPT_STATE_KEY) ?? 'null'
    );
}

function advance(ms: number) {
    act(() => {
        vi.advanceTimersByTime(ms);
    });
}

/** 방문자가 페이지를 한 번 조작했다. */
function engage(type = 'pointerdown', target: EventTarget = window) {
    act(() => {
        target.dispatchEvent(new Event(type, { bubbles: true }));
    });
}

/** 내용이 든 입력란에 포커스를 둔다 — "입력 중" 상태. 정리 함수를 돌려준다. */
function focusField(value: string): HTMLInputElement {
    const input = document.createElement('input');
    input.value = value;
    document.body.append(input);
    input.focus();
    return input;
}

describe('VocPromptHost', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        vi.useFakeTimers();
        seedOneUseShort();
    });
    afterEach(() => {
        vi.useRealTimers();
        localStorage.clear();
        sessionStorage.clear();
        document.body.querySelectorAll('input').forEach(el => el.remove());
    });

    // shared는 entities를 import할 수 없어 같은 값 집합을 두 곳에 정의한다. 한쪽에만 값이 늘면
    // 여기서 타입 검사가 실패한다.
    it('모달을 띄운 계기(VocTrigger)와 이용 기록의 사이트 구분(VocPromptSurface)은 같은 집합이다', () => {
        expectTypeOf<VocTrigger>().toEqualTypeOf<VocPromptSurface>();
    });

    describe('siglens.io (analysis)', () => {
        it('신호 전에는 아무것도 그리지 않는다', () => {
            render(<VocPromptHost trigger="analysis" />);

            engage();
            advance(ANALYSIS_DELAY_MS * 2);

            expect(dialog()).not.toBeInTheDocument();
        });

        it('진입 직후가 아니라 20초 뒤에 연다 - 분석 지연은 챗 지연보다 길다', () => {
            expect(ANALYSIS_DELAY_MS).toBe(20_000);
            expect(ANALYSIS_DELAY_MS).toBeGreaterThan(CHAT_DELAY_MS);
        });

        it('이미 조작한 방문자에게는 물어볼 때가 된 분석 신호 뒤 지연이 지나면 열린다', () => {
            render(<VocPromptHost trigger="analysis" />);

            engage();
            act(() => publishSymbolAnalyzed('NVDA'));
            advance(ANALYSIS_DELAY_MS - 1);
            expect(dialog()).not.toBeInTheDocument();

            advance(1);
            expect(dialog()).toBeInTheDocument();
        });

        it('지연이 지나도 방문자가 페이지를 조작하기 전에는 열지 않는다 - 크롤러와 측정 도구는 모달을 보지 않는다', () => {
            render(<VocPromptHost trigger="analysis" />);

            act(() => publishSymbolAnalyzed('NVDA'));
            advance(ANALYSIS_DELAY_MS * 10);

            expect(dialog()).not.toBeInTheDocument();
        });

        it.each(['pointerdown', 'touchstart', 'wheel', 'keydown'])(
            '%s은 조작이다 - 지연 뒤에 오면 그 순간이 아니라 조금 뒤에 연다',
            type => {
                render(<VocPromptHost trigger="analysis" />);

                act(() => publishSymbolAnalyzed('NVDA'));
                advance(ANALYSIS_DELAY_MS);
                engage(type);
                // 입력과 같은 순간에 열면 방문자가 막 시작한 동작을 모달이 가로챈다.
                expect(dialog()).not.toBeInTheDocument();

                advance(VOC_PROMPT_SETTLE_MS - 1);
                expect(dialog()).not.toBeInTheDocument();
                advance(1);
                expect(dialog()).toBeInTheDocument();
            }
        );

        // 스크롤 복원·`scrollIntoView` 같은 스크립트 스크롤도 `scroll`을 낸다 - 조작으로 치면 입력이
        // 없는 렌더러에서도 모달이 열린다. `click`은 스크립트가 낼 수 있고 `pointerdown`이 이미 덮는다.
        it.each(['scroll', 'click'])(
            '%s은 조작으로 치지 않는다 - 스크립트가 낼 수 있는 이벤트다',
            type => {
                render(<VocPromptHost trigger="analysis" />);

                engage(type);
                engage(type, document.body);
                act(() => publishSymbolAnalyzed('NVDA'));
                advance(ANALYSIS_DELAY_MS * 3);

                expect(dialog()).not.toBeInTheDocument();
            }
        );

        it('안쪽 요소에서 난 입력도 조작으로 센다(캡처 단계)', () => {
            render(
                <>
                    <button type="button">안쪽</button>
                    <VocPromptHost trigger="analysis" />
                </>
            );

            const inner = screen.getByRole('button', { name: '안쪽' });
            inner.addEventListener('pointerdown', event =>
                event.stopPropagation()
            );
            engage('pointerdown', inner);
            act(() => publishSymbolAnalyzed('NVDA'));
            advance(ANALYSIS_DELAY_MS);

            expect(dialog()).toBeInTheDocument();
        });

        it('신호를 받은 즉시 "묻기로 했다" 기록과 세션 넛지 플래그를 함께 남긴다', () => {
            render(<VocPromptHost trigger="analysis" />);

            act(() => publishSymbolAnalyzed('NVDA'));

            // 모달은 아직이지만 기록은 이미 있다 - 조건을 못 채우고 떠나는 짧은 방문이 이어져도
            // VOC가 "물어볼 때"로 남아 가입 넛지와 코치 마크를 계속 막지 않는다.
            expect(dialog()).not.toBeInTheDocument();
            expect(storedState()).toMatchObject({ promptCount: 0, uses: 0 });
            expect(storedState().lastPromptedAt).toBeGreaterThan(0);
            expect(
                sessionStorage.getItem(SESSION_STORAGE_NUDGE_SHOWN_KEY)
            ).toBe('1');
        });

        it('여러 번 분석돼도 한 번만 열리고, 닫으면 다시 열리지 않는다', () => {
            render(<VocPromptHost trigger="analysis" />);

            engage();
            act(() => publishSymbolAnalyzed('NVDA'));
            act(() => publishSymbolAnalyzed('AAPL'));
            advance(ANALYSIS_DELAY_MS);
            expect(screen.getAllByRole('dialog')).toHaveLength(1);

            act(() => {
                screen.getByRole('button', { name: '닫기' }).click();
            });
            expect(dialog()).not.toBeInTheDocument();

            act(() => publishSymbolAnalyzed('TSLA'));
            engage();
            advance(ANALYSIS_DELAY_MS * 2);
            expect(dialog()).not.toBeInTheDocument();
        });

        it('별점을 이미 보낸 방문자에게는 신호가 와도 열지 않는다', () => {
            seedState({ uses: 5, submitted: true });
            render(<VocPromptHost trigger="analysis" />);

            engage();
            act(() => publishSymbolAnalyzed('NVDA'));
            advance(ANALYSIS_DELAY_MS * 2);

            expect(dialog()).not.toBeInTheDocument();
        });

        it('이 탭 세션에 다른 넛지가 떴으면 열지 않고, "묻기로 했다" 기록도 남기지 않는다', () => {
            sessionStorage.setItem(SESSION_STORAGE_NUDGE_SHOWN_KEY, '1');
            render(<VocPromptHost trigger="analysis" />);

            engage();
            act(() => publishSymbolAnalyzed('NVDA'));
            advance(ANALYSIS_DELAY_MS * 2);

            expect(dialog()).not.toBeInTheDocument();
            // 조건은 채워진 채로 남아 다음 세션에서 물을 수 있어야 한다.
            expect(storedState()).toMatchObject({
                lastPromptedAt: 0,
                uses: 3,
            });
        });

        it('다른 넛지 때문에 미룬 방문자는 다음 세션의 첫 신호에 본다', () => {
            sessionStorage.setItem(SESSION_STORAGE_NUDGE_SHOWN_KEY, '1');
            const first = render(<VocPromptHost trigger="analysis" />);
            act(() => publishSymbolAnalyzed('NVDA'));
            first.unmount();

            sessionStorage.clear();
            render(<VocPromptHost trigger="analysis" />);
            engage();
            // 이미 센 종목이어도 조건은 채워져 있다.
            act(() => publishSymbolAnalyzed('NVDA'));
            advance(ANALYSIS_DELAY_MS);

            expect(dialog()).toBeInTheDocument();
        });

        describe('언제 묻는가 - 써 보고 쓸모를 느낀 뒤', () => {
            beforeEach(() => {
                localStorage.clear();
            });

            it('첫 분석 한 번으로는 묻지 않는다', () => {
                render(<VocPromptHost trigger="analysis" />);

                engage();
                act(() => publishSymbolAnalyzed('NVDA'));
                advance(ANALYSIS_DELAY_MS * 2);

                expect(dialog()).not.toBeInTheDocument();
                // 세션 슬롯도 잡지 않는다 - 가입 넛지와 코치 마크가 쓸 수 있다.
                expect(
                    sessionStorage.getItem(SESSION_STORAGE_NUDGE_SHOWN_KEY)
                ).toBeNull();
            });

            it('같은 종목을 여러 번 봐도 한 번으로 센다', () => {
                render(<VocPromptHost trigger="analysis" />);

                engage();
                act(() => publishSymbolAnalyzed('NVDA'));
                act(() => publishSymbolAnalyzed('NVDA'));
                act(() => publishSymbolAnalyzed('NVDA'));
                advance(ANALYSIS_DELAY_MS * 2);

                expect(dialog()).not.toBeInTheDocument();
            });

            it('서로 다른 종목을 정해진 수만큼 보면 그 분석 뒤에 묻는다', () => {
                expect(VOC_PROMPT_POLICY.analysis.minUses).toBe(3);
                render(<VocPromptHost trigger="analysis" />);

                engage();
                act(() => publishSymbolAnalyzed('NVDA'));
                act(() => publishSymbolAnalyzed('AAPL'));
                advance(ANALYSIS_DELAY_MS * 2);
                expect(dialog()).not.toBeInTheDocument();

                act(() => publishSymbolAnalyzed('TSLA'));
                advance(ANALYSIS_DELAY_MS);
                expect(dialog()).toBeInTheDocument();
            });

            it('다른 날 다시 와서 분석을 보면 한 종목이어도 묻는다', () => {
                expect(VOC_PROMPT_POLICY.analysis.minActiveDays).toBe(2);
                vi.setSystemTime(new Date(2026, 10, 14, 10));
                const first = render(<VocPromptHost trigger="analysis" />);
                act(() => publishSymbolAnalyzed('NVDA'));
                first.unmount();

                vi.setSystemTime(new Date(2026, 10, 15, 10));
                render(<VocPromptHost trigger="analysis" />);
                engage();
                act(() => publishSymbolAnalyzed('NVDA'));
                advance(ANALYSIS_DELAY_MS);

                expect(dialog()).toBeInTheDocument();
            });

            it('닫기만 한 방문자에게는 간격이 지나고 다시 조건을 채웠을 때 한 번 더 묻는다', () => {
                vi.setSystemTime(new Date(2026, 10, 14, 10));
                seedOneUseShort();
                const first = render(<VocPromptHost trigger="analysis" />);
                engage();
                act(() => publishSymbolAnalyzed('NVDA'));
                advance(ANALYSIS_DELAY_MS);
                act(() => {
                    screen.getByRole('button', { name: '닫기' }).click();
                });
                first.unmount();

                // 간격 안에는 조건을 다시 채워도 묻지 않는다.
                const second = render(<VocPromptHost trigger="analysis" />);
                engage();
                act(() => publishSymbolAnalyzed('A'));
                act(() => publishSymbolAnalyzed('B'));
                act(() => publishSymbolAnalyzed('C'));
                advance(ANALYSIS_DELAY_MS * 2);
                expect(dialog()).not.toBeInTheDocument();
                second.unmount();

                vi.setSystemTime(Date.now() + VOC_PROMPT_COOLDOWN_MS);
                sessionStorage.clear();
                render(<VocPromptHost trigger="analysis" />);
                engage();
                act(() => publishSymbolAnalyzed('D'));
                advance(ANALYSIS_DELAY_MS);
                expect(dialog()).toBeInTheDocument();
                expect(storedState().promptCount).toBe(2);
            });
        });

        it('지연 중에는 이미 세션을 선점해 뒤따르는 구독자가 같은 신호에 양보한다', () => {
            render(<VocPromptHost trigger="analysis" />);
            let seenByOthers = false;
            const unsubscribe = subscribeSymbolAnalyzed(() => {
                seenByOthers = hasNudgeShownThisSession();
            });

            engage();
            act(() => publishSymbolAnalyzed('NVDA'));
            unsubscribe();

            expect(seenByOthers).toBe(true);
            advance(ANALYSIS_DELAY_MS);
            expect(dialog()).toBeInTheDocument();
        });

        describe('입력 중인 방문자', () => {
            it('내용이 든 입력란에 포커스가 있으면 미뤘다가, 입력이 끝나면 연다', () => {
                render(<VocPromptHost trigger="analysis" />);
                const field = focusField('TSLA');

                engage('keydown');
                act(() => publishSymbolAnalyzed('NVDA'));
                advance(ANALYSIS_DELAY_MS);
                // 지금 열면 포커스 트랩이 검색어 입력을 가로챈다.
                expect(dialog()).not.toBeInTheDocument();

                field.blur();
                advance(VOC_PROMPT_TYPING_RETRY_MS);
                expect(dialog()).toBeInTheDocument();
            });

            it('계속 입력 중이면 정해진 횟수만 미루고 이 세션에는 열지 않는다', () => {
                render(<VocPromptHost trigger="analysis" />);
                const field = focusField('TSLA');

                engage('keydown');
                act(() => publishSymbolAnalyzed('NVDA'));
                advance(
                    ANALYSIS_DELAY_MS +
                        VOC_PROMPT_TYPING_RETRY_MS * VOC_PROMPT_TYPING_RETRIES
                );
                expect(dialog()).not.toBeInTheDocument();

                field.blur();
                advance(VOC_PROMPT_TYPING_RETRY_MS * 4);
                expect(dialog()).not.toBeInTheDocument();
            });

            it('비어 있는 입력란의 포커스는 입력 중이 아니다', () => {
                render(<VocPromptHost trigger="analysis" />);
                focusField('');

                engage();
                act(() => publishSymbolAnalyzed('NVDA'));
                advance(ANALYSIS_DELAY_MS);

                expect(dialog()).toBeInTheDocument();
            });
        });

        it('지연 안에 떠나면(언마운트) 열리지 않고, 물은 횟수도 쓰지 않는다', () => {
            const { unmount } = render(<VocPromptHost trigger="analysis" />);

            engage();
            act(() => publishSymbolAnalyzed('NVDA'));
            unmount();
            advance(ANALYSIS_DELAY_MS * 2);

            expect(dialog()).not.toBeInTheDocument();
            // 모달을 못 본 짧은 방문이 이어져도 상한이 차지 않는다.
            expect(storedState().promptCount).toBe(0);
        });

        it('모달이 열리면 물은 횟수를 센다', () => {
            render(<VocPromptHost trigger="analysis" />);

            engage();
            act(() => publishSymbolAnalyzed('NVDA'));
            advance(ANALYSIS_DELAY_MS);

            expect(dialog()).toBeInTheDocument();
            expect(storedState().promptCount).toBe(1);
        });

        it('"묻기로 했다"를 기록하지 못하면 열지 않고 세션 슬롯도 잡지 않는다', () => {
            render(<VocPromptHost trigger="analysis" />);
            const realSetItem = Storage.prototype.setItem;
            let localWrites = 0;
            // 이용 기록(첫 쓰기)은 되고 그 다음 쓰기부터 실패한다.
            const setItemSpy = vi
                .spyOn(Storage.prototype, 'setItem')
                .mockImplementation(function (this: Storage, key, value) {
                    if (this === localStorage) {
                        localWrites += 1;
                        if (localWrites > 1) throw new Error('quota');
                    }
                    realSetItem.call(this, key, value);
                });

            engage();
            act(() => publishSymbolAnalyzed('NVDA'));
            advance(ANALYSIS_DELAY_MS * 2);
            setItemSpy.mockRestore();

            expect(dialog()).not.toBeInTheDocument();
            expect(
                sessionStorage.getItem(SESSION_STORAGE_NUDGE_SHOWN_KEY)
            ).toBeNull();
        });

        it('조작을 기다리는 틈에 떠나도(언마운트) 열리지 않는다', () => {
            const { unmount } = render(<VocPromptHost trigger="analysis" />);

            act(() => publishSymbolAnalyzed('NVDA'));
            advance(ANALYSIS_DELAY_MS);
            engage();
            unmount();
            advance(VOC_PROMPT_SETTLE_MS * 2);

            expect(dialog()).not.toBeInTheDocument();
        });

        it('언마운트하면 구독과 입력 리스너를 해제한다', () => {
            const removeSpy = vi.spyOn(window, 'removeEventListener');
            const { unmount } = render(<VocPromptHost trigger="analysis" />);
            unmount();

            act(() => publishSymbolAnalyzed('NVDA'));
            engage();
            advance(ANALYSIS_DELAY_MS * 2);

            expect(dialog()).not.toBeInTheDocument();
            expect(removeSpy.mock.calls.map(call => call[0])).toEqual(
                expect.arrayContaining([
                    'pointerdown',
                    'touchstart',
                    'wheel',
                    'keydown',
                ])
            );
            removeSpy.mockRestore();
        });

        it('시그렌즈 AI 신호에는 반응하지 않는다', () => {
            render(<VocPromptHost trigger="analysis" />);

            engage();
            act(() => publishAgentTurnCompleted());
            advance(ANALYSIS_DELAY_MS * 2);

            expect(dialog()).not.toBeInTheDocument();
        });
    });

    describe('ai.siglens.io (agent_chat)', () => {
        it('질문을 보낸 방문자는 물어볼 때가 된 답변 턴이 끝나고 2.5초 뒤 본다', () => {
            render(<VocPromptHost trigger="agent_chat" />);

            // 질문을 입력해 보낸 것 자체가 조작이다.
            engage('keydown');
            act(() => publishAgentTurnCompleted());
            advance(CHAT_DELAY_MS - 1);
            expect(dialog()).not.toBeInTheDocument();

            advance(1);
            expect(dialog()).toBeInTheDocument();
        });

        it('첫 답변 하나로는 묻지 않고, 정해진 수만큼 답을 받으면 묻는다', () => {
            localStorage.clear();
            expect(VOC_PROMPT_POLICY.agent_chat.minUses).toBe(3);
            render(<VocPromptHost trigger="agent_chat" />);

            engage('keydown');
            act(() => publishAgentTurnCompleted());
            act(() => publishAgentTurnCompleted());
            advance(CHAT_DELAY_MS * 2);
            expect(dialog()).not.toBeInTheDocument();

            act(() => publishAgentTurnCompleted());
            advance(CHAT_DELAY_MS);
            expect(dialog()).toBeInTheDocument();
        });

        it('질문을 보낸 뒤 비어 있는 입력창이 포커스를 쥐고 있어도 열린다', () => {
            render(<VocPromptHost trigger="agent_chat" />);
            focusField('');

            engage('keydown');
            act(() => publishAgentTurnCompleted());
            advance(CHAT_DELAY_MS);

            expect(dialog()).toBeInTheDocument();
        });

        it('종목 분석 신호에는 반응하지 않는다', () => {
            render(<VocPromptHost trigger="agent_chat" />);

            engage();
            act(() => publishSymbolAnalyzed('NVDA'));
            advance(ANALYSIS_DELAY_MS * 2);

            expect(dialog()).not.toBeInTheDocument();
        });

        it('세션 넛지 플래그를 존중한다', () => {
            sessionStorage.setItem(SESSION_STORAGE_NUDGE_SHOWN_KEY, '1');
            render(<VocPromptHost trigger="agent_chat" />);

            engage();
            act(() => publishAgentTurnCompleted());
            advance(CHAT_DELAY_MS * 2);

            expect(dialog()).not.toBeInTheDocument();
        });
    });
});
