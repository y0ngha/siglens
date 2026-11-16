import { describe, expect, it } from 'vitest';
import { htmlToText } from '../htmlToText';

describe('htmlToText', () => {
    it('스크립트·스타일·주석·head를 내용째 버린다', () => {
        const html =
            '<html><head><title>t.htm</title></head><body><style>p{color:red}</style><script>alert(1)</script><!-- hidden --><p>Hello</p></body></html>';
        expect(htmlToText(html)).toBe('Hello');
    });

    it('인라인 XBRL 숨김 헤더를 버린다', () => {
        const html =
            '<div style="display:none"><ix:header><ix:hidden>0001234567 2026-11-10</ix:hidden></ix:header></div><p>Real text</p>';
        expect(htmlToText(html)).toBe('Real text');
    });

    it('단락·줄바꿈·제목·목록을 줄바꿈으로 바꾼다', () => {
        const html =
            '<h1>Title</h1><p>One</p><div>Two<br>Three</div><ul><li>A</li><li>B</li></ul>';
        expect(htmlToText(html)).toBe('Title\nOne\nTwo\nThree\nA\nB');
    });

    it('이름 있는 엔티티를 풀어 쓴다', () => {
        const html =
            '<p>A&amp;B &lt;x&gt; &quot;q&quot; &apos;s&apos; &ldquo;L&rdquo; &lsquo;l&rsquo; 1&ndash;2 &mdash; wait&hellip; Acme&reg; Foo&trade; a&nbsp;b</p>';
        expect(htmlToText(html)).toBe(
            'A&B <x> "q" \'s\' “L” ‘l’ 1–2 — wait… Acme® Foo™ a b'
        );
    });

    it('숫자 엔티티(10진·16진)를 풀고 잘못된 값은 버린다', () => {
        expect(
            htmlToText(
                '<p>&#8217;s &#x2019; &#160;x &#0; &#xD800; &#1114112;</p>'
            )
        ).toBe('’s ’ x');
    });

    it('모르는 엔티티는 그대로 둔다', () => {
        expect(htmlToText('<p>&foo; bar</p>')).toBe('&foo; bar');
    });

    it('엔티티로 쓴 꺾쇠는 태그로 오인해 지우지 않는다', () => {
        expect(htmlToText('<p>&lt;b&gt;bold&lt;/b&gt;</p>')).toBe(
            '<b>bold</b>'
        );
    });

    it('표 셀을 " | "로 잇고 구분자뿐인 행은 버린다', () => {
        const html =
            '<table><tr><td>Revenue</td><td>$ 12.4</td><td>$ 9.1</td></tr>' +
            '<tr><td></td><td>&nbsp;</td></tr>' +
            '<tr><td>Net income</td><td></td><td>$ 3.3</td></tr></table>';
        expect(htmlToText(html)).toBe(
            'Revenue | $ 12.4 | $ 9.1\nNet income | $ 3.3'
        );
    });

    it('셀 안의 단락이 행을 쪼개지 않는다', () => {
        const html =
            '<table><tr><td><p>Cash</p></td><td><div>$ 5</div></td></tr></table>';
        expect(htmlToText(html)).toBe('Cash | $ 5');
    });

    it('본문의 실제 파이프 문자는 건드리지 않는다', () => {
        expect(htmlToText('<p>A | B</p>')).toBe('A | B');
    });

    it('공백·탭을 접고 줄마다 다듬으며 빈 줄 3개 이상은 2개로 줄인다', () => {
        const html = '<p>  a \t  b  </p><p></p><p></p><p></p><p>  c</p>';
        expect(htmlToText(html)).toBe('a b\n\nc');
    });

    describe('신뢰할 수 없는 256KB 입력에서도 선형 시간이다', () => {
        const SIZE = 256 * 1024;
        // 제곱 시간이면 수십 초가 걸리던 입력들 — 여유 있게 잡은 상한으로 회귀만 막는다.
        const TIME_BOUND_MS = 1_500;
        const elapsed = (input: string): number => {
            const started = performance.now();
            htmlToText(input);
            return performance.now() - started;
        };

        it.each([
            ['닫히지 않은 <', '<'],
            ['닫히지 않은 주석', '<!--'],
            ['닫히지 않은 script', '<script '],
            ['닫히지 않은 tr', '<tr '],
            ['닫히지 않은 br', '<br '],
        ])('%s가 가득한 입력', (_name, token) => {
            const input = token.repeat(Math.floor(SIZE / token.length));
            expect(elapsed(input)).toBeLessThan(TIME_BOUND_MS);
        });

        it.each([
            ['script 뒤에 </scriptx>', '<script ', '</scriptx>'],
            ['tr 뒤에 </track>', '<tr ', '</track>'],
            ['head 뒤에 </header>', '<head ', '</header>'],
            ['style 뒤에 </styles>', '<style ', '</styles>'],
        ])(
            '접두사만 같은 닫는 태그(%s)를 구간 끝으로 오인하지 않는다',
            (_n, open, fake) => {
                const input =
                    open.repeat(Math.floor(SIZE / open.length)) + fake;
                expect(elapsed(input)).toBeLessThan(TIME_BOUND_MS);
            }
        );

        // 닫힌 행 경로(행 찾기 + 행 안 태그 펴기) 전체의 시간 상한이다. 행 안 태그 패턴의 문자 클래스 하나를
        // 겨냥한 테스트가 아니다 — 행은 `</tr>`로 끝나 그 패턴은 어느 꼴이든 선형이다.
        it.each([
            ['닫히지 않은 p', '<p '],
            ['닫히지 않은 div', '<div '],
        ])('닫힌 표 행 안에 %s가 가득한 입력', (_name, token) => {
            const input = `<table><tr><td>${token.repeat(Math.floor(SIZE / token.length))}</td></tr></table>`;
            expect(elapsed(input)).toBeLessThan(TIME_BOUND_MS);
        });

        it('마지막 닫는 태그 뒤에 여는 태그가 가득해도 앞의 정상 블록은 처리한다', () => {
            const input = `<p>앞</p><!-- 숨김 --><p>본문</p>${'<!--'.repeat(40_000)}`;
            expect(elapsed(input)).toBeLessThan(TIME_BOUND_MS);
            expect(htmlToText(input)).toBe('앞\n본문');
        });
    });

    it('닫히지 않은 script·주석 뒤의 내용은 블록 내용으로 보고 버린다(head 상한에서 잘린 문서)', () => {
        expect(htmlToText('<p>본문</p><script>var a = "<p>가짜</p>";')).toBe(
            '본문'
        );
        expect(htmlToText('<p>본문</p><!-- 잘린 주석 <p>가짜</p>')).toBe(
            '본문'
        );
    });

    it('닫히지 않은 tr은 태그만 걷어 내고 내용은 남긴다', () => {
        expect(htmlToText('<table><tr><td>a</td><td>b</td>')).toContain('a');
    });

    it('공시에 흔한 이름 붙은 엔티티(·, €)를 풀고 폭 없는 문자·소프트 하이픈을 지운다', () => {
        expect(
            htmlToText(
                '<p>&middot; Revenue &euro;24.1 billion</p><p>\u200bOperating Review\u200b</p><p>co&shy;operation</p>'
            )
        ).toBe('· Revenue €24.1 billion\nOperating Review\ncooperation');
    });

    it('빈 입력은 빈 문자열', () => {
        expect(htmlToText('')).toBe('');
        expect(htmlToText('<div> </div>')).toBe('');
    });
});
