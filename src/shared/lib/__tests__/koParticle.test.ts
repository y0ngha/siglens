import { hasBatchim, koWithParticle } from '@/shared/lib/koParticle';

/**
 * 조사 선택은 번역이 아니라 **한국어 문법**이라 소스에 남는 유일한 한글이다.
 * ICU에 받침 규칙이 없어 판정을 소스가 해야 하므로, 그 판정이 맞는지는 여기서
 * 고정한다 — 틀리면 `공포과 같습니다` 같은 비문이 ko 화면에 나간다.
 */
describe('hasBatchim', () => {
    it.each([
        ['중립', true],
        ['탐욕', true],
        ['공포', false],
        ['극단적 공포', false],
    ])('%s → %s', (word, expected) => {
        expect(hasBatchim(word)).toBe(expected);
    });

    it('한글이 아닌 문자는 받침 없음으로 본다', () => {
        expect(hasBatchim('AAPL')).toBe(false);
        expect(hasBatchim('')).toBe(false);
    });
});

describe('koWithParticle', () => {
    it('받침이 있으면 과, 없으면 와를 붙인다', () => {
        expect(koWithParticle('중립')).toBe('중립과');
        expect(koWithParticle('공포')).toBe('공포와');
    });
});
