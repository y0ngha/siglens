import {
    isInternalHref,
    opensInNewTab,
} from '@/widgets/legal/utils/policyHref';

describe('isInternalHref', () => {
    it.each([
        ['/privacy', true],
        ['/account/delete', true],
        ['//cdn.example.com/file.pdf', false],
        ['https://example.com', false],
        ['mailto:stock.siglens@gmail.com', false],
        ['#article-1', false],
        ['', false],
        [undefined, false],
    ] as const)('%s → %s', (href, expected) => {
        expect(isInternalHref(href)).toBe(expected);
    });
});

describe('opensInNewTab', () => {
    it.each([
        ['https://example.com', true],
        ['//cdn.example.com/file.pdf', true],
        ['', true],
        [undefined, true],
        // 메일·전화는 외부 앱으로 넘어가므로 새 탭이면 빈 탭만 남는다.
        ['mailto:stock.siglens@gmail.com', false],
        ['MAILTO:stock.siglens@gmail.com', false],
        ['tel:+82-10-0000-0000', false],
        // 문서 내 앵커는 같은 문서 안에서 이동한다.
        ['#article-1', false],
    ] as const)('%s → %s', (href, expected) => {
        expect(opensInNewTab(href)).toBe(expected);
    });
});
