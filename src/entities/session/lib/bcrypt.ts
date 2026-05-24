import { compare, hash } from 'bcryptjs';
import type { PasswordHasher, PasswordVerifier } from './types';

/** @internal Salt rounds for the default bcrypt adapter — cost 12 balances brute-force resistance and per-request CPU cost. */
export const BCRYPT_DEFAULT_SALT_ROUNDS = 12;

/** Default {@link PasswordHasher} backed by `bcryptjs` with cost {@link BCRYPT_DEFAULT_SALT_ROUNDS}. */
export const bcryptPasswordHasher: PasswordHasher = {
    hashPassword(password: string): Promise<string> {
        return hash(password, BCRYPT_DEFAULT_SALT_ROUNDS);
    },
};

/** Default {@link PasswordVerifier} backed by `bcryptjs`; compares plain-text against a stored hash in constant time. */
export const bcryptPasswordVerifier: PasswordVerifier = {
    verifyPassword(password: string, passwordHash: string): Promise<boolean> {
        return compare(password, passwordHash);
    },
};
