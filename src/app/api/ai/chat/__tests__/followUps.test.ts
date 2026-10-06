import { describe, expect, it, vi } from 'vitest';

/** core 판정 호출 횟수를 세려고 감싼다(동작은 원본 그대로). */
const { splitCalls } = vi.hoisted(() => ({ splitCalls: vi.fn() }));
vi.mock('@y0ngha/siglens-core', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@y0ngha/siglens-core')>();
    return {
        ...actual,
        splitAgentFollowUps: (text: string) => {
            splitCalls(text);
            return actual.splitAgentFollowUps(text);
        },
    };
});

import { splitAgentFollowUps } from '@y0ngha/siglens-core';
import {
    createFollowUpTextFilter,
    followUpLine,
    withFollowUpLine,
} from '@/app/api/ai/chat/followUps';

/** 조각들을 필터에 차례로 넣고, 클라이언트가 받게 될 조각들을 돌려준다. */
function run(deltas: readonly string[]): string[] {
    const filter = createFollowUpTextFilter();
    return deltas.map(delta => filter.push(delta));
}

describe('createFollowUpTextFilter', () => {
    it('평범한 답변은 받은 그대로 흘려보낸다', () => {
        expect(run(['안녕', '하세요.\n', '둘째 줄'])).toEqual([
            '안녕',
            '하세요.\n',
            '둘째 줄',
        ]);
    });

    it('마커 줄은 쪼개져 와도 한 글자도 내보내지 않는다', () => {
        const out = run(['본문.\n', '[', '[foll', 'owups]] A', ' | B']).join(
            ''
        );
        expect(out).toBe('본문.\n');
        expect(out).not.toContain('[');
    });

    it('`[`로 시작했지만 마커가 아니면 확정되는 순간 보류분까지 내보낸다', () => {
        const out = run(['본문\n', '[', '1] 출처']);
        expect(out).toEqual(['본문\n', '', '[1] 출처']);
        expect(out.join('')).toBe('본문\n[1] 출처');
    });

    it('마커 줄 앞의 빈 줄이 잘려 본문이 짧아져도 이미 보낸 글을 되돌리지 않는다', () => {
        const out = run(['본문.\n\n', '[[followups]] A']);
        // 끝 공백(`\n\n`)은 이미 나갔다 — 남는 건 공백뿐이고 `done`의 body가 덮는다.
        expect(out).toEqual(['본문.\n\n', '']);
    });

    it('줄 중간의 마커는 일반 텍스트다', () => {
        expect(run(['앞 [[followups]] 중간'])).toEqual([
            '앞 [[followups]] 중간',
        ]);
    });

    it('reset 뒤에는 보류분을 잊고 새 답변을 처음부터 판정한다', () => {
        const filter = createFollowUpTextFilter();
        expect(filter.push('나레이션\n[')).toBe('나레이션');
        filter.reset();
        expect(filter.push('새 답변')).toBe('새 답변');
    });
});

/**
 * 증분 구현 이전의 정의 그대로 — 매 조각 누적 원문 전체를 core에 넘겨 본문을 구하고,
 * 이미 보낸 접두사를 본문이 이어 쓸 때만 늘어난 만큼 내보낸다.
 */
function reference(deltas: readonly string[]): string[] {
    let raw = '';
    let sent = '';
    return deltas.map(delta => {
        raw += delta;
        const { body } = splitAgentFollowUps(raw);
        if (body.length <= sent.length || !body.startsWith(sent)) return '';
        const next = body.slice(sent.length);
        sent = body;
        return next;
    });
}

/** 시드 고정 의사난수 — 실패를 재현할 수 있게. */
function seeded(seed: number): () => number {
    let x = seed;
    return () => {
        x = (x * 1103515245 + 12345) % 2147483648;
        return x / 2147483648;
    };
}

describe('createFollowUpTextFilter — 증분 처리', () => {
    const SAMPLES = [
        '본문입니다.\n\n[[followups]] 실적은? | 뉴스는?',
        '본문\n  [[followups]] A | B  \n\n',
        '본문\n[[followups]]\n',
        '본문\n[[followups]] | | ',
        '앞\n[[followups]] 중간\n뒤에 이어지는 문장',
        '[1] 출처 표기로 시작하는 줄\n다음 줄',
        '[',
        '\n\n   \n',
        '문단\n\n- 목록\n[[foll',
        '탭\t뒤\r\n[[followups]] A\r\n',
        '[[followups]] 첫 줄부터 마커',
        '😀 이모지\n[[followups]] 😀',
    ];

    it('어떤 조각 나누기에서도 이전 정의(누적 원문 전체 판정)와 같은 조각을 내보낸다', () => {
        const random = seeded(42);
        for (const sample of SAMPLES) {
            for (let trial = 0; trial < 50; trial++) {
                const deltas: string[] = [];
                let at = 0;
                while (at < sample.length) {
                    const size = 1 + Math.floor(random() * 6);
                    deltas.push(sample.slice(at, at + size));
                    at += size;
                }
                expect(run(deltas), `${JSON.stringify(deltas)}`).toEqual(
                    reference(deltas)
                );
            }
        }
    });

    it('마커가 될 수 없는 줄(첫 글자가 `[`가 아님)에서는 core 판정을 부르지 않는다', () => {
        splitCalls.mockClear();
        const long = '가나다라마바사 '.repeat(500);
        run([...long, '\n', ...'둘째 줄도 길다']);
        expect(splitCalls).not.toHaveBeenCalled();
    });

    it('core에는 누적 원문이 아니라 마지막 줄부터의 꼬리만 넘긴다', () => {
        splitCalls.mockClear();
        run(['긴 본문 '.repeat(200), '\n[', '[followups]] A']);
        for (const [text] of splitCalls.mock.calls)
            expect((text as string).startsWith('[')).toBe(true);
    });
});

describe('withFollowUpLine', () => {
    it('본문 뒤에 빈 줄과 마커 줄을 붙인다', () => {
        expect(withFollowUpLine('본문', ['A', 'B'])).toBe(
            '본문\n\n[[followups]] A | B'
        );
    });

    it('항목의 구분자·줄바꿈은 공백으로 바꾸고 빈 항목은 버린다', () => {
        expect(withFollowUpLine('본문', ['A|B', ' ', '줄\n바꿈'])).toBe(
            '본문\n\n[[followups]] A B | 줄 바꿈'
        );
    });

    it('core 파서처럼 먼저 3개로 자른 뒤 다듬는다 (빈 항목이 뒤 항목을 끌어올리지 않는다)', () => {
        expect(withFollowUpLine('본문', [' ', 'A', 'B', 'C', 'D'])).toBe(
            '본문\n\n[[followups]] A | B'
        );
    });

    it('항목마다 60자(코드 포인트)로 자른다', () => {
        const long = '가'.repeat(59) + '😀😀';
        expect(followUpLine([long])).toBe(
            `\n\n[[followups]] ${'가'.repeat(59)}😀`
        );
    });

    it('남는 항목이 없으면 본문 그대로다', () => {
        expect(withFollowUpLine('본문', [])).toBe('본문');
        expect(withFollowUpLine('본문', ['  ', '|'])).toBe('본문');
    });
});
