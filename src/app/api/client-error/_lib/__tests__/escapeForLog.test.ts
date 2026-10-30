import { describe, it, expect } from 'vitest';
import { escapeForLog } from '@/app/api/client-error/_lib/escapeForLog';

describe('escapeForLog', () => {
    it('개행을 %0A로 바꿔 한 줄로 만든다', () => {
        expect(escapeForLog('a\nb')).toBe('a%0Ab');
    });

    it('P1 마커가 품은 공백과 대괄호를 인코딩한다', () => {
        expect(escapeForLog('JavaScript heap out of memory')).toBe(
            'JavaScript%20heap%20out%20of%20memory'
        );
        expect(escapeForLog('[selfcheck]')).toBe('%5Bselfcheck%5D');
    });

    it('decodeURIComponent로 손실 없이 되돌아온다', () => {
        const raw = '{"message":"한글 \\n \\" 끝"}';
        expect(decodeURIComponent(escapeForLog(raw))).toBe(raw);
    });
});
