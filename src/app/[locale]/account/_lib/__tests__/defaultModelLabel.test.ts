import { defaultModelLabel } from '../defaultModelLabel';

describe('defaultModelLabel', () => {
    it('미설정(null)이면 null', () => {
        expect(defaultModelLabel(null)).toBeNull();
    });

    it('더 이상 제공하지 않는 모델이면 null', () => {
        expect(defaultModelLabel('retired-model-x')).toBeNull();
    });

    it('프로토타입 이름은 모델로 보지 않는다', () => {
        expect(defaultModelLabel('constructor')).toBeNull();
    });

    it('제공 중인 모델이면 전체 표시명', () => {
        expect(defaultModelLabel('gemini-3.6-flash')).toBe('Gemini 3.6 Flash');
    });
});
