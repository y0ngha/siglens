import { describe, expect, it } from 'vitest';
import { pickFilingDocument } from '../pickFilingDocument';

function index(names: string[]) {
    return {
        directory: {
            item: names.map(name => ({ name, size: '' })),
        },
    };
}

const IONQ = index([
    '0001193125-26-461016-index-headers.html',
    '0001193125-26-461016-index.html',
    '0001193125-26-461016.txt',
    'FilingSummary.xml',
    'img1365411_0.jpg',
    'ionq-20261110.htm',
    'ionq-20261110_htm.xml',
    'ionq-ex5_1.htm',
    'ionq-ex99_1.htm',
    'MetaLinks.json',
]);

describe('pickFilingDocument', () => {
    it('IonQ: ex99 첨부를 보도자료로 고른다(ex5_1·색인 페이지는 후보에서 밀린다)', () => {
        expect(pickFilingDocument(IONQ, 'ionq-20261110.htm')).toEqual({
            fileName: 'ionq-ex99_1.htm',
            document: 'press_release',
        });
    });

    it('ex99가 여럿이면 번호가 낮은 쪽', () => {
        const picked = pickFilingDocument(
            index([
                'main.htm',
                'x-ex99_2.htm',
                'x-ex99_10.htm',
                'x-ex99_1.htm',
            ]),
            'main.htm'
        );
        expect(picked.fileName).toBe('x-ex99_1.htm');
    });

    it('NVDA: ex99 이름이 없어도 다른 후보가 하나뿐이면 그것이 보도자료', () => {
        const nvda = index([
            '0001045810-26-000200-index-headers.html',
            '0001045810-26-000200-index.html',
            'nvda-20261111.htm',
            'nvda-20261111.xsd',
            'nvda-20261111_htm.xml',
            'nvidiaannouncesceotransiti.htm',
            'R1.htm',
            'MetaLinks.json',
        ]);
        expect(pickFilingDocument(nvda, 'nvda-20261111.htm')).toEqual({
            fileName: 'nvidiaannouncesceotransiti.htm',
            document: 'press_release',
        });
    });

    it('SEALSQ(6-K): ex99-1 첨부', () => {
        const sealsq = index([
            'ea0309878-6k_sealsq.htm',
            'ea030987801ex99-1.htm',
            'img1.jpg',
            'img2.jpg',
        ]);
        expect(pickFilingDocument(sealsq, 'ea0309878-6k_sealsq.htm')).toEqual({
            fileName: 'ea030987801ex99-1.htm',
            document: 'press_release',
        });
    });

    it('ex99가 없고 후보가 둘이면 추측하지 않고 주 문서', () => {
        const picked = pickFilingDocument(
            index(['main.htm', 'ex10_1.htm', 'ex5_1.htm']),
            'main.htm'
        );
        expect(picked).toEqual({ fileName: 'main.htm', document: 'primary' });
    });

    it('후보가 없으면 주 문서', () => {
        expect(
            pickFilingDocument(
                index(['main.htm', 'FilingSummary.xml']),
                'main.htm'
            )
        ).toEqual({ fileName: 'main.htm', document: 'primary' });
    });

    it.each([
        'acme-ex10_1.htm',
        'ex3-1.htm',
        'ex5_1.htm',
        'exhibit101.htm',
        'Exhibit-21.htm',
    ])('다른 첨부(%s) 하나뿐이면 보도자료로 추측하지 않고 주 문서', exhibit => {
        expect(
            pickFilingDocument(index(['main.htm', exhibit]), 'main.htm')
        ).toEqual({
            fileName: 'main.htm',
            document: 'primary',
        });
    });

    it('번호 있는 다른 첨부는 후보에서 빠지고 번호 없는 파일 하나가 남으면 그것(NVDA 모양)', () => {
        expect(
            pickFilingDocument(
                index([
                    'main.htm',
                    'ex10_1.htm',
                    'nvidiaannouncesceotransiti.htm',
                ]),
                'main.htm'
            )
        ).toEqual({
            fileName: 'nvidiaannouncesceotransiti.htm',
            document: 'press_release',
        });
    });

    it('exhibit99 이름도 보도자료로 본다', () => {
        expect(
            pickFilingDocument(
                index(['main.htm', 'exhibit99-1.htm', 'ex10_1.htm']),
                'main.htm'
            ).fileName
        ).toBe('exhibit99-1.htm');
    });

    it('색인 페이지와 XBRL 뷰어 조각은 단독 후보로도 취급하지 않는다', () => {
        const picked = pickFilingDocument(
            index([
                'main.htm',
                'R2.htm',
                'x-index.html',
                'x-index-headers.html',
            ]),
            'main.htm'
        );
        expect(picked.document).toBe('primary');
    });

    it.each([
        null,
        undefined,
        {},
        { directory: {} },
        { directory: { item: 'x' } },
        'x',
    ])('알 수 없는 index(%j)면 주 문서', json => {
        expect(pickFilingDocument(json, 'main.htm')).toEqual({
            fileName: 'main.htm',
            document: 'primary',
        });
    });
});
