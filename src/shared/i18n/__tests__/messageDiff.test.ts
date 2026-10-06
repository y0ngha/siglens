import type { AbstractIntlMessages } from 'next-intl';
import { mergeMessages, omitMessages } from '../messageDiff';

const PARENT = {
    widgets: { layout: { title: '헤더', nav: { home: '홈' } } },
    shared: { ui: { close: '닫기' } },
} as AbstractIntlMessages;

describe('omitMessages', () => {
    it('상위에 이미 있는 잎을 빼고 차이만 남긴다', () => {
        const route = {
            widgets: {
                layout: { title: '헤더', nav: { home: '홈' } },
                news: { heading: '뉴스' },
            },
            shared: { ui: { close: '닫기', open: '열기' } },
        } as AbstractIntlMessages;

        expect(omitMessages(route, PARENT)).toEqual({
            widgets: { news: { heading: '뉴스' } },
            shared: { ui: { open: '열기' } },
        });
    });

    it('전부 상위에 있으면 빈 객체가 된다(빈 서브트리도 남기지 않는다)', () => {
        expect(omitMessages(PARENT, PARENT)).toEqual({});
    });

    it('배열 값은 잎으로 다룬다', () => {
        const route = {
            tips: { paragraphs: ['a', 'b'] },
        } as unknown as AbstractIntlMessages;
        const present = {
            tips: { paragraphs: ['a', 'b'] },
        } as unknown as AbstractIntlMessages;

        expect(omitMessages(route, present)).toEqual({});
    });
});

describe('mergeMessages', () => {
    it('부모와 차이를 깊게 합쳐 원래 라우트 메시지를 되살린다', () => {
        const route = {
            widgets: {
                layout: { title: '헤더', nav: { home: '홈' } },
                news: { heading: '뉴스' },
            },
            shared: { ui: { close: '닫기', open: '열기' } },
        } as AbstractIntlMessages;

        const merged = mergeMessages(PARENT, omitMessages(route, PARENT));

        expect(merged).toEqual(route);
    });

    it('부모 객체를 변경하지 않는다', () => {
        const snapshot = JSON.stringify(PARENT);

        mergeMessages(PARENT, { widgets: { extra: { a: 'b' } } });

        expect(JSON.stringify(PARENT)).toBe(snapshot);
    });
});
