import { validateKeyName } from '@/entities/siglens-api-key/lib/validateKeyName';
import { API_KEY_NAME_MAX_LENGTH } from '@/shared/config/publicApi';

describe('validateKeyName', () => {
    it('trim한 이름을 돌려준다', () => {
        expect(validateKeyName('  내 에이전트  ')).toBe('내 에이전트');
    });

    it('상한 길이까지 허용하고 넘으면 거절한다', () => {
        expect(validateKeyName('a'.repeat(API_KEY_NAME_MAX_LENGTH))).toBe(
            'a'.repeat(API_KEY_NAME_MAX_LENGTH)
        );
        expect(
            validateKeyName('a'.repeat(API_KEY_NAME_MAX_LENGTH + 1))
        ).toBeNull();
    });

    it('공백뿐인 이름은 서버에서도 거절한다', () => {
        expect(validateKeyName('   ')).toBeNull();
        expect(validateKeyName('')).toBeNull();
    });

    it('문자열이 아니면 거절한다(FormData의 File·null 포함)', () => {
        expect(validateKeyName(null)).toBeNull();
        expect(validateKeyName(undefined)).toBeNull();
        expect(validateKeyName(new File(['x'], 'x.txt'))).toBeNull();
    });

    it('제어 문자가 든 이름은 거절한다', () => {
        expect(validateKeyName('a\nb')).toBeNull();
        expect(validateKeyName('a\tb')).toBeNull();
        expect(validateKeyName('a\u007fb')).toBeNull();
    });

    it('아주 긴 입력은 trim·검사 전에 거절한다', () => {
        expect(
            validateKeyName(' '.repeat(API_KEY_NAME_MAX_LENGTH * 2 + 1))
        ).toBeNull();
    });
});
