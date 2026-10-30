import {
    paragraphs,
    prose,
    sectionTitle,
} from '@/entities/email-report/templates/htmlBlocks';

describe('paragraphs', () => {
    it('줄바꿈으로 나누고 앞뒤 공백과 빈 줄을 버린다', () => {
        expect(paragraphs(' 첫째 \n\n\n  \n둘째')).toEqual(['첫째', '둘째']);
    });
});

describe('sectionTitle', () => {
    it('라벨을 이스케이프한다', () => {
        expect(sectionTitle('<b>뉴스</b>')).toContain(
            '&lt;b&gt;뉴스&lt;/b&gt;'
        );
    });
});

describe('prose', () => {
    it('문단마다 <p>를 만들고 본문을 이스케이프한다', () => {
        const html = prose('a & b\nc');

        expect(html.match(/<p /g)).toHaveLength(2);
        expect(html).toContain('a &amp; b');
    });

    it('색을 넘기면 문단에 그 색을 쓴다', () => {
        expect(prose('x', '#123456')).toContain('color:#123456');
    });
});
