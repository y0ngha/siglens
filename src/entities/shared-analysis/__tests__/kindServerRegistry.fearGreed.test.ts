import { describe, expect, it } from 'vitest';
import { SHARE_KIND_OG_BUILDERS } from '../server/kindServerRegistry';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';

const tOg = catalogTranslator('entities.shared-analysis.og', 'ko');

/*
 * 공유 링크의 og/meta description은 사용자가 링크를 붙일 때마다 보는 문자열이다.
 * 그런데 점수를 `String(r.score)`로 그대로 찍고 있어, 실제 스냅샷에서
 * `공포·탐욕 지수 42.73276474769012`가 나갔다 — 같은 페이지 본문은 `43`을
 * 보여주므로 서로 어긋난다. 화면 컴포넌트들은 이미 `Math.round`를 쓰고 있었고
 * 메타만 예외였다.
 */
describe('SHARE_KIND_OG_BUILDERS.fear-greed', () => {
    const build = SHARE_KIND_OG_BUILDERS['fear-greed'];

    it('점수를 반올림해서 내보낸다 — 원시 소수가 그대로 나가면 안 된다', () => {
        const out = build(
            { label: 'FEAR', score: 42.73276474769012 },
            'AAPL',
            tOg
        );
        const text = JSON.stringify(out);
        expect(text).toContain('43');
        expect(text).not.toContain('42.73');
    });

    it('경계값도 반올림 규칙을 따른다', () => {
        expect(JSON.stringify(build({ score: 42.4 }, 'AAPL', tOg))).toContain(
            '42'
        );
        expect(JSON.stringify(build({ score: 42.5 }, 'AAPL', tOg))).toContain(
            '43'
        );
    });

    it('숫자 문자열도 반올림해서 보여준다 — 값을 잃지 않는다', () => {
        expect(JSON.stringify(build({ score: '42.7' }, 'AAPL', tOg))).toContain(
            '43'
        );
    });

    it('점수가 없거나 숫자로 해석할 수 없으면 NaN을 내보내지 않는다', () => {
        for (const score of [
            undefined,
            null,
            'abc',
            Number.NaN,
            Infinity,
            // `Number('')`와 `Number('  ')`가 0이라, 강제 변환을 먼저 하면
            // 없는 점수 0을 지어낸다 — 아무것도 안 보이는 것보다 나쁘다.
            '',
            '   ',
        ]) {
            const text = JSON.stringify(build({ score }, 'AAPL', tOg));
            expect(text).not.toContain('NaN');
            expect(text).not.toContain('지수 0');
            expect(text).not.toContain('Infinity');
            expect(text).toContain('공포·탐욕 지수');
        }
    });
});
