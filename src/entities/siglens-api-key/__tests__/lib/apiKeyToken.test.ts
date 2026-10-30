import {
    isWellFormedApiKey,
    parseBearerApiKey,
} from '@/entities/siglens-api-key/lib/apiKeyToken';

describe('isWellFormedApiKey', () => {
    const valid = `slk_${'a'.repeat(40)}`;

    it('정상 형식은 통과한다', () => {
        expect(isWellFormedApiKey(valid)).toBe(true);
    });

    it.each([
        ['접두 없음', 'a'.repeat(44)],
        ['39자', `slk_${'a'.repeat(39)}`],
        ['41자', `slk_${'a'.repeat(41)}`],
        ['base62 밖 문자', `slk_${'a'.repeat(39)}-`],
        ['대문자 접두', `SLK_${'a'.repeat(40)}`],
        ['빈 문자열', ''],
    ])('%s은 거절한다', (_label, value) => {
        expect(isWellFormedApiKey(value)).toBe(false);
    });
});

describe('parseBearerApiKey', () => {
    const key = `slk_${'Z9'.repeat(20)}`;

    it('Bearer 헤더에서 키를 꺼낸다', () => {
        expect(parseBearerApiKey(`Bearer ${key}`)).toBe(key);
    });

    it('스킴 대소문자와 앞뒤 공백을 허용한다', () => {
        expect(parseBearerApiKey(`  bearer   ${key}  `)).toBe(key);
    });

    it.each([
        ['헤더 없음', null],
        ['다른 스킴', `Basic ${`slk_${'a'.repeat(40)}`}`],
        ['토큰 없음', 'Bearer '],
        ['키 형식 아님', 'Bearer not-a-key'],
        ['토큰 뒤에 값이 더 있음', `Bearer ${key} extra`],
    ])('%s이면 null', (_label, header) => {
        expect(parseBearerApiKey(header)).toBeNull();
    });
});
