import { readFormText } from '../readFormText';

describe('readFormText', () => {
    it('문자열 필드를 그대로 읽는다', () => {
        const form = new FormData();
        form.set('email', 'a@b.com');

        expect(readFormText(form, 'email')).toBe('a@b.com');
    });

    it('없는 필드는 빈 문자열이다', () => {
        expect(readFormText(new FormData(), 'email')).toBe('');
    });

    it('파일 같은 문자열이 아닌 값은 빈 문자열이다', () => {
        const form = new FormData();
        form.set('email', new File(['x'], 'x.txt'));

        expect(readFormText(form, 'email')).toBe('');
    });
});
