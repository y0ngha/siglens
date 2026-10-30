import {
    normalizeCeo,
    normalizeWebsite,
} from '@/widgets/fundamental/utils/profileLinks';

describe('normalizeWebsite', () => {
    it.each([null, '', '   '])('비었으면 null이다 (%j)', raw => {
        expect(normalizeWebsite(raw)).toBeNull();
    });

    it('https URL은 그대로 두고 스킴을 뗀 라벨을 만든다', () => {
        expect(normalizeWebsite('https://www.apple.com')).toEqual({
            href: 'https://www.apple.com',
            label: 'www.apple.com',
        });
    });

    it('http도 허용하고 라벨에서 스킴을 뗀다', () => {
        expect(normalizeWebsite('HTTP://example.com/a')).toEqual({
            href: 'HTTP://example.com/a',
            label: 'example.com/a',
        });
    });

    it('스킴이 없으면 https를 붙인다', () => {
        expect(normalizeWebsite('www.apple.com')).toEqual({
            href: 'https://www.apple.com',
            label: 'www.apple.com',
        });
    });

    it('앞뒤 공백을 다듬는다', () => {
        expect(normalizeWebsite('  apple.com  ')?.href).toBe(
            'https://apple.com'
        );
    });

    it('포트가 붙은 호스트는 스킴으로 오인하지 않는다', () => {
        expect(normalizeWebsite('example.com:8080')?.href).toBe(
            'https://example.com:8080'
        );
    });

    it('프로토콜 상대 URL은 https로 올린다', () => {
        expect(normalizeWebsite('//example.com')?.href).toBe(
            'https://example.com'
        );
    });

    it.each([
        'javascript:alert(1)',
        'JavaScript:alert(1)',
        'data:text/html,<b>x</b>',
        'mailto:ir@apple.com',
        'ftp://files.example.com',
    ])('http(s)가 아닌 스킴은 숨긴다 (%s)', raw => {
        expect(normalizeWebsite(raw)).toBeNull();
    });

    it('파싱이 안 되는 값은 숨긴다', () => {
        expect(normalizeWebsite('http://')).toBeNull();
    });
});

describe('normalizeCeo', () => {
    it('이름을 다듬는다', () => {
        expect(normalizeCeo('  Tim Cook ')).toBe('Tim Cook');
    });

    it.each([null, '', '  \n '])('비었으면 null이다 (%j)', raw => {
        expect(normalizeCeo(raw)).toBeNull();
    });
});
