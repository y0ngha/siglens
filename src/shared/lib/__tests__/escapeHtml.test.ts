import { escapeHtml } from '@/shared/lib/escapeHtml';

describe('escapeHtml', () => {
    it('HTML 특수문자 다섯 개를 엔티티로 바꾼다', () => {
        expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
            '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;'
        );
    });

    it('이미 이스케이프된 엔티티도 다시 이스케이프한다(이중 해석 방지)', () => {
        expect(escapeHtml('&amp;')).toBe('&amp;amp;');
    });

    it('특수문자가 없으면 그대로다', () => {
        expect(escapeHtml('삼성전자 005930')).toBe('삼성전자 005930');
    });
});
