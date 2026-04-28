/** next/headers cookies().set() 호출에 전달되는 옵션 형태. */
export interface ResponseCookie {
    name: string;
    value: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
    path: string;
    expires: Date;
    maxAge: number;
}
