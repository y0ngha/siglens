import { createHash, randomBytes } from 'node:crypto';
import type {
    PasswordResetTokenGenerator,
    PasswordResetTokenHasher,
} from '@y0ngha/siglens-core';

/** 32바이트 random URL-safe 토큰 — 256 bit entropy. */
const TOKEN_BYTE_LENGTH = 32;

export const passwordResetTokenGenerator: PasswordResetTokenGenerator = {
    generatePasswordResetToken(): string {
        return randomBytes(TOKEN_BYTE_LENGTH).toString('base64url');
    },
};

export const passwordResetTokenHasher: PasswordResetTokenHasher = {
    hashPasswordResetToken(token: string): string {
        return createHash('sha256').update(token).digest('hex');
    },
};
