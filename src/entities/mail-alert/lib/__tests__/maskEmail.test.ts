import { maskEmail } from '../maskEmail';

describe('maskEmail', () => {
    it('로컬 파트의 첫 글자만 남기고 도메인은 그대로 둔다', () => {
        expect(maskEmail('alice@gmail.com')).toBe('a***@gmail.com');
    });

    it('로컬 파트가 두 글자 이하여도 첫 글자만 남긴다', () => {
        expect(maskEmail('ab@x.io')).toBe('a***@x.io');
        expect(maskEmail('a@x.io')).toBe('a***@x.io');
    });

    it('@가 여러 개면 마지막 @를 도메인 경계로 본다', () => {
        expect(maskEmail('a@b@c.com')).toBe('a***@c.com');
    });

    it('@가 없는 값은 첫 글자만 남긴다', () => {
        expect(maskEmail('plain')).toBe('p***');
    });
});
