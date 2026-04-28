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
