import {
    LOCAL_STORAGE_VOC_PROMPT_STATE_KEY,
    LOCAL_STORAGE_VOC_PROMPTED_KEY,
} from '@/shared/lib/storageKeys';
import {
    VOC_PROMPT_COOLDOWN_MS,
    VOC_PROMPT_MAX_PROMPTS,
    isVocPromptDue,
    isVocPromptRetired,
    claimVocPrompt,
    markVocShown,
    markVocSubmitted,
    recordVocUse,
} from '@/shared/lib/vocPromptStorage';

const DAY1 = new Date(2026, 10, 14, 10).getTime();
const DAY2 = new Date(2026, 10, 15, 10).getTime();

function stored(): Record<string, unknown> {
    return JSON.parse(
        localStorage.getItem(LOCAL_STORAGE_VOC_PROMPT_STATE_KEY) ?? 'null'
    );
}

describe('vocPromptStorage', () => {
    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    describe('이용 횟수 조건', () => {
        it('서로 다른 종목 셋째에서 물어볼 때가 된다', () => {
            expect(recordVocUse('analysis', 'NVDA', DAY1)).toBe(false);
            expect(recordVocUse('analysis', 'AAPL', DAY1)).toBe(false);
            expect(recordVocUse('analysis', 'TSLA', DAY1)).toBe(true);
        });

        it('같은 종목은 한 번만 센다', () => {
            recordVocUse('analysis', 'NVDA', DAY1);
            recordVocUse('analysis', 'NVDA', DAY1);
            expect(recordVocUse('analysis', 'NVDA', DAY1)).toBe(false);
            expect(stored()).toMatchObject({ uses: 1, seen: ['NVDA'] });
        });

        it('키가 없으면(답변 턴) 신호마다 한 번으로 센다', () => {
            expect(recordVocUse('agent_chat', undefined, DAY1)).toBe(false);
            expect(recordVocUse('agent_chat', undefined, DAY1)).toBe(false);
            expect(recordVocUse('agent_chat', undefined, DAY1)).toBe(true);
        });

        it('본 종목은 조건에 필요한 수까지만 저장한다', () => {
            ['A', 'B', 'C', 'D', 'E'].forEach(symbol =>
                recordVocUse('analysis', symbol, DAY1)
            );
            expect(stored()).toMatchObject({ uses: 5, seen: ['A', 'B', 'C'] });
        });
    });

    describe('다시 온 날 조건', () => {
        it('다른 날 다시 쓰면 한 종목이어도 물어볼 때가 된다', () => {
            expect(recordVocUse('analysis', 'NVDA', DAY1)).toBe(false);
            expect(recordVocUse('analysis', 'NVDA', DAY2)).toBe(true);
        });

        it('이용한 날은 조건에 필요한 수까지만 저장한다', () => {
            recordVocUse('agent_chat', undefined, DAY1);
            recordVocUse('agent_chat', undefined, DAY2);
            recordVocUse(
                'agent_chat',
                undefined,
                DAY2 + VOC_PROMPT_COOLDOWN_MS
            );
            expect(stored().days).toHaveLength(2);
        });
    });

    describe('isVocPromptDue - 기록하지 않고 미리 본다', () => {
        it('이번 이용까지 세면 물어볼 때인지 답하고 저장소는 그대로 둔다', () => {
            recordVocUse('analysis', 'NVDA', DAY1);
            recordVocUse('analysis', 'AAPL', DAY1);
            const before = localStorage.getItem(
                LOCAL_STORAGE_VOC_PROMPT_STATE_KEY
            );

            expect(isVocPromptDue('analysis', 'AAPL', DAY1)).toBe(false);
            expect(isVocPromptDue('analysis', 'TSLA', DAY1)).toBe(true);
            expect(
                localStorage.getItem(LOCAL_STORAGE_VOC_PROMPT_STATE_KEY)
            ).toBe(before);
        });

        it('호스트가 같은 이용을 먼저 기록했어도 답이 같다 - 구독 순서와 무관하다', () => {
            recordVocUse('analysis', 'NVDA', DAY1);
            recordVocUse('analysis', 'AAPL', DAY1);
            recordVocUse('analysis', 'TSLA', DAY1);

            expect(isVocPromptDue('analysis', 'TSLA', DAY1)).toBe(true);
        });

        it('기록이 없는 첫 이용은 물어볼 때가 아니다', () => {
            expect(isVocPromptDue('analysis', 'NVDA', DAY1)).toBe(false);
        });
    });

    describe('물은 뒤', () => {
        function reachDue(now: number) {
            ['A', 'B', 'C'].forEach(s => recordVocUse('analysis', s, now));
        }

        it('묻기로 하면 이용 기록을 비우고 시각을 적되, 횟수는 세지 않는다', () => {
            reachDue(DAY1);
            expect(claimVocPrompt(DAY1)).toBe(true);

            expect(stored()).toEqual({
                uses: 0,
                seen: [],
                days: [],
                promptCount: 0,
                lastPromptedAt: DAY1,
                submitted: false,
            });
        });

        it('모달이 열리면 횟수를 센다', () => {
            reachDue(DAY1);
            claimVocPrompt(DAY1);
            markVocShown();

            expect(stored()).toMatchObject({
                promptCount: 1,
                lastPromptedAt: DAY1,
            });
        });

        it('모달이 열리지 않은 방문은 간격만 다시 시작하고 상한을 쓰지 않는다', () => {
            let now = DAY1;
            for (let i = 0; i < VOC_PROMPT_MAX_PROMPTS + 1; i += 1) {
                reachDue(now);
                claimVocPrompt(now);
                now += VOC_PROMPT_COOLDOWN_MS;
            }

            expect(isVocPromptRetired()).toBe(false);
        });

        it('기기 시계가 앞서 있을 때 적힌 시각(미래)은 간격이 지난 것으로 본다', () => {
            reachDue(DAY1);
            claimVocPrompt(DAY1 + VOC_PROMPT_COOLDOWN_MS * 100);
            reachDue(DAY1);

            expect(isVocPromptDue('analysis', 'D', DAY1)).toBe(true);
        });

        it('간격 안에는 조건을 다시 채워도 묻지 않고, 간격이 지나면 묻는다', () => {
            reachDue(DAY1);
            claimVocPrompt(DAY1);

            reachDue(DAY1 + VOC_PROMPT_COOLDOWN_MS - 1);
            expect(
                isVocPromptDue(
                    'analysis',
                    'D',
                    DAY1 + VOC_PROMPT_COOLDOWN_MS - 1
                )
            ).toBe(false);
            expect(
                isVocPromptDue('analysis', 'D', DAY1 + VOC_PROMPT_COOLDOWN_MS)
            ).toBe(true);
        });

        it('간격이 지나도 그 사이 다시 쓰지 않았으면 묻지 않는다', () => {
            reachDue(DAY1);
            claimVocPrompt(DAY1);

            expect(
                isVocPromptDue('analysis', 'A', DAY1 + VOC_PROMPT_COOLDOWN_MS)
            ).toBe(false);
        });

        it('상한만큼 물었으면 더는 묻지 않는다', () => {
            let now = DAY1;
            for (let i = 0; i < VOC_PROMPT_MAX_PROMPTS; i += 1) {
                expect(isVocPromptRetired()).toBe(false);
                reachDue(now);
                claimVocPrompt(now);
                markVocShown();
                now += VOC_PROMPT_COOLDOWN_MS;
            }

            expect(isVocPromptRetired()).toBe(true);
            expect(recordVocUse('analysis', 'Z', now)).toBe(false);
            expect(isVocPromptDue('analysis', 'Z', now)).toBe(false);
        });

        it('별점을 보냈으면 다시 묻지 않는다', () => {
            reachDue(DAY1);
            claimVocPrompt(DAY1);
            markVocSubmitted();

            expect(isVocPromptRetired()).toBe(true);
            reachDue(DAY1 + VOC_PROMPT_COOLDOWN_MS);
            expect(
                isVocPromptDue('analysis', 'D', DAY1 + VOC_PROMPT_COOLDOWN_MS)
            ).toBe(false);
        });
    });

    describe('예전 기록(첫 이용 직후 한 번 띄웠다)', () => {
        it('한 번 물은 것으로 이어받되, 조건을 채우면 간격 없이 다시 묻는다', () => {
            localStorage.setItem(LOCAL_STORAGE_VOC_PROMPTED_KEY, '1');

            expect(recordVocUse('analysis', 'A', DAY1)).toBe(false);
            recordVocUse('analysis', 'B', DAY1);
            expect(recordVocUse('analysis', 'C', DAY1)).toBe(true);
            claimVocPrompt(DAY1);
            markVocShown();
            expect(stored().promptCount).toBe(2);
        });
    });

    describe('저장소가 온전하지 않을 때', () => {
        it('읽기가 막혀 있으면 묻지 않는다(매 방문 뜨지 않도록)', () => {
            vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
                throw new Error('blocked');
            });

            expect(isVocPromptRetired()).toBe(true);
            expect(isVocPromptDue('analysis', 'NVDA')).toBe(false);
            expect(recordVocUse('analysis', 'NVDA')).toBe(false);
            expect(claimVocPrompt()).toBe(false);
            expect(() => markVocSubmitted()).not.toThrow();
        });

        it('쓰기가 막혀 있으면 조건을 채워도 묻지 않는다', () => {
            localStorage.setItem(
                LOCAL_STORAGE_VOC_PROMPT_STATE_KEY,
                JSON.stringify({
                    uses: 2,
                    seen: ['A', 'B'],
                    days: [],
                    promptCount: 0,
                    lastPromptedAt: 0,
                    submitted: false,
                })
            );
            vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw new Error('quota');
            });

            expect(recordVocUse('analysis', 'C', DAY1)).toBe(false);
            expect(claimVocPrompt(DAY1)).toBe(false);
        });

        it.each(['not json', '{"uses":"3"}', 'null'])(
            '깨진 값(%s)은 기록 없음으로 본다',
            raw => {
                localStorage.setItem(LOCAL_STORAGE_VOC_PROMPT_STATE_KEY, raw);

                expect(isVocPromptRetired()).toBe(false);
                expect(recordVocUse('analysis', 'NVDA', DAY1)).toBe(false);
                expect(stored()).toMatchObject({ uses: 1, promptCount: 0 });
            }
        );
    });
});
