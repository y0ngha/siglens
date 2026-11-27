import { guidePathForSkill, patternIdForSkill } from '../guideLinkLookup';

describe('guidePathForSkill', () => {
    it('스킬 이름으로 가이드 경로를 찾는다', () => {
        expect(guidePathForSkill('Doji Pattern Guide')).toBe(
            '/guide/candlesticks/doji'
        );
    });

    it('스킬 이름이 맵에 없으면 탐지 id로 찾는다', () => {
        expect(guidePathForSkill('없는 스킬', 'doji')).toBe(
            '/guide/candlesticks/doji'
        );
    });

    it('둘 다 없으면 null', () => {
        expect(guidePathForSkill('없는 스킬', 'nothing')).toBeNull();
        expect(guidePathForSkill('없는 스킬')).toBeNull();
    });

    it('프로토타입 키는 경로가 아니다', () => {
        expect(guidePathForSkill('constructor', 'toString')).toBeNull();
    });
});

describe('patternIdForSkill', () => {
    it('maps a chart pattern skill name to its canonical pattern id', () => {
        expect(patternIdForSkill('헤드앤숄더')).toBe('head_and_shoulders');
    });

    it('is null for unknown names and prototype keys', () => {
        expect(patternIdForSkill('없는 스킬')).toBeNull();
        expect(patternIdForSkill('constructor')).toBeNull();
    });
});
