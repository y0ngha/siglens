import { describe, expect, it } from 'vitest';
import { stripUtmParams } from '../stripUtmParams';

describe('stripUtmParams', () => {
    it('utm_* 파라미터만 떼고 나머지 쿼리·해시는 둔다', () => {
        expect(
            stripUtmParams(
                'https://example.com/a?utm_source=x&id=7&UTM_Medium=y&utm_campaign=z#top'
            )
        ).toBe('https://example.com/a?id=7#top');
    });

    it('남는 쿼리가 없으면 물음표도 없고, 해시는 남는다', () => {
        expect(stripUtmParams('https://example.com/a?utm_source=x')).toBe(
            'https://example.com/a'
        );
        expect(stripUtmParams('https://example.com/a?utm_source=x#frag')).toBe(
            'https://example.com/a#frag'
        );
    });

    it.each([
        'https://example.com',
        'https://example.com/a?id=1',
        'https://example.com/a b?q=a%20b&r=~x',
        'https://example.com/a?q=a%20b&r=a+b&s=~',
        'https://example.com/a?x=1&&y=2',
        'https://example.com/a#utm_source=x',
        'not a url',
        '',
    ])('utm_*가 없으면 입력을 바이트 그대로 돌려준다: %s', url => {
        expect(stripUtmParams(url)).toBe(url);
    });

    it('남기는 파라미터는 재직렬화 없이 원문 그대로다(%20·~·+·빈 값)', () => {
        expect(
            stripUtmParams(
                'https://example.com/a?q=a%20b&utm_source=x&r=~x&s=a+b&t=&utm_term'
            )
        ).toBe('https://example.com/a?q=a%20b&r=~x&s=a+b&t=');
    });

    it('호스트만 있는 주소에서 추적 파라미터만 있으면 슬래시를 붙이지 않는다', () => {
        expect(stripUtmParams('https://example.com?utm_source=x')).toBe(
            'https://example.com'
        );
    });

    it('`utm_`로 시작하지 않는 비슷한 키는 지우지 않는다', () => {
        expect(stripUtmParams('https://example.com/a?utmx=1&my_utm_a=2')).toBe(
            'https://example.com/a?utmx=1&my_utm_a=2'
        );
    });
});
