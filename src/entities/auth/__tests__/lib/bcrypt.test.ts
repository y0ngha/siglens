import type { MockedFunction } from 'vitest';
vi.mock('bcryptjs', () => ({
    hash: vi.fn(),
    compare: vi.fn(),
}));

import { compare, hash } from 'bcryptjs';
import {
    BCRYPT_DEFAULT_SALT_ROUNDS,
    bcryptPasswordHasher,
    bcryptPasswordVerifier,
} from '@/entities/auth/lib/bcrypt';

const mockedHash = hash as MockedFunction<typeof hash>;
const mockedCompare = compare as MockedFunction<typeof compare>;

beforeEach(() => {
    mockedHash.mockReset();
    mockedCompare.mockReset();
});

describe('bcryptPasswordHasher', () => {
    it('delegates to bcryptjs.hash with the default salt rounds', async () => {
        mockedHash.mockResolvedValue('hashed-password' as never);

        const result = await bcryptPasswordHasher.hashPassword('Password1!');

        expect(mockedHash).toHaveBeenCalledWith(
            'Password1!',
            BCRYPT_DEFAULT_SALT_ROUNDS
        );
        expect(result).toBe('hashed-password');
    });
});

describe('bcryptPasswordVerifier', () => {
    it('returns true when bcryptjs.compare reports a match', async () => {
        mockedCompare.mockResolvedValue(true as never);

        const matches = await bcryptPasswordVerifier.verifyPassword(
            'Password1!',
            'stored-hash'
        );

        expect(mockedCompare).toHaveBeenCalledWith('Password1!', 'stored-hash');
        expect(matches).toBe(true);
    });

    it('returns false when bcryptjs.compare reports a mismatch', async () => {
        mockedCompare.mockResolvedValue(false as never);

        const matches = await bcryptPasswordVerifier.verifyPassword(
            'WrongPassword!',
            'stored-hash'
        );

        expect(matches).toBe(false);
    });
});
