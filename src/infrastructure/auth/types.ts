type CookieSameSite = 'lax' | 'strict' | 'none';

/** next/headers cookies().set() 호출에 전달되는 옵션 형태. */
export interface ResponseCookie {
    name: string;
    value: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite: CookieSameSite;
    path: string;
    expires: Date;
    maxAge: number;
}

/** Interface for hashing plain-text passwords before storage. */
export interface PasswordHasher {
    /** Hash a plain-text password and return the storage-safe hash. */
    hashPassword(password: string): Promise<string>;
}

/** Interface for comparing a plain-text password against a stored password hash. */
export interface PasswordVerifier {
    /** Compare a plain-text password with a stored password hash in constant time. */
    verifyPassword(password: string, passwordHash: string): Promise<boolean>;
}
