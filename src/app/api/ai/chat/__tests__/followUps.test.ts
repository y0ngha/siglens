import { describe, expect, it } from 'vitest';
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
