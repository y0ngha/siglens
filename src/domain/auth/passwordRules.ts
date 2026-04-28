export const MIN_PASSWORD_LENGTH = 8;

export function hasMinLength(password: string): boolean {
    return password.length >= MIN_PASSWORD_LENGTH;
}

export function hasLetter(password: string): boolean {
    return /[A-Za-z]/.test(password);
}

export function hasNumber(password: string): boolean {
    return /\d/.test(password);
}
