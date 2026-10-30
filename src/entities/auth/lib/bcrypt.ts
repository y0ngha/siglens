import { compare, hash } from 'bcryptjs';
import type { PasswordHasher, PasswordVerifier } from '@/shared/lib/auth/types';

/** bcrypt 솔트 라운드 — cost 12가 무차별 대입 저항과 요청당 CPU 비용의 균형점이다. */
export const BCRYPT_DEFAULT_SALT_ROUNDS = 12;

/** 가입·비밀번호 재설정이 쓰는 기본 {@link PasswordHasher}. cost는 {@link BCRYPT_DEFAULT_SALT_ROUNDS}. */
export const bcryptPasswordHasher: PasswordHasher = {
    hashPassword(password: string): Promise<string> {
        return hash(password, BCRYPT_DEFAULT_SALT_ROUNDS);
    },
};

/** 로그인·비밀번호 재설정이 쓰는 기본 {@link PasswordVerifier}. 평문과 저장된 해시를 `bcryptjs`의 상수 시간 비교로 검증한다. */
export const bcryptPasswordVerifier: PasswordVerifier = {
    verifyPassword(password: string, passwordHash: string): Promise<boolean> {
        return compare(password, passwordHash);
    },
};
