import { isSessionToken } from '@/entities/auth/lib/isSessionToken';

describe('isSessionToken', () => {
    it.each([
        '123e4567-e89b-12d3-a456-426614174000',
        '123E4567-E89B-12D3-A456-426614174000',
    ])('uuid 형식 %s를 받아들인다', value => {
        expect(isSessionToken(value)).toBe(true);
    });

    it.each([
        '',
        'stale-token',
        '123e4567e89b12d3a456426614174000',
        '123e4567-e89b-12d3-a456-42661417400',
        '123e4567-e89b-12d3-a456-4266141740000',
        "123e4567-e89b-12d3-a456-426614174000'; --",
        ' 123e4567-e89b-12d3-a456-426614174000',
    ])('uuid가 아닌 %j는 거부한다', value => {
        expect(isSessionToken(value)).toBe(false);
    });
});
