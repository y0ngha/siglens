import { describe, expect, it } from 'vitest';
import { extractPrimaryHeadline } from '../extractPrimaryHeadline';

describe('extractPrimaryHeadline', () => {
    it('(f) NVIDIA: 항목 제목이 같은 줄에 있으면 본문 첫 문장 — Inc.에서 끊지 않는다', () => {
        const text = [
            'Item 8.01. Other Events.',
            '',
            'On September 2, 2026, NVIDIA Corporation (“NVIDIA”) entered into a definitive agreement to acquire Hugging Face, Inc. (“Hugging Face”). Hugging Face operates a platform and community for developing, sharing and deploying open-source models, datasets and applications.',
            '',
            'The transaction includes ...',
            'Item 9.01. Financial Statements and Exhibits.',
        ].join('\n');
        expect(extractPrimaryHeadline(text)).toBe(
            'On September 2, 2026, NVIDIA Corporation (“NVIDIA”) entered into a definitive agreement to acquire Hugging Face, Inc. (“Hugging Face”).'
        );
    });

    it('(g) Apple: 번호와 제목이 따로 줄이면 제목 줄을 건너뛰고, 긴 첫 문장은 200자 단어 경계에서 자른다', () => {
        const text = [
            'Item 8.01',
            '',
            'Other Events.',
            '',
            'On November 9, 2026, Apple Inc. (“Apple”) consummated the issuance and sale of $500,000,000 aggregate principal amount of its Floating Rate Notes due 2028 (the “2028 Floating Rate Notes”), $750,000,000 aggregate principal amount of its Fixed Rate Notes due 2029 and others.',
        ].join('\n');
        const headline = extractPrimaryHeadline(text) ?? '';
        expect(
            headline.startsWith(
                'On November 9, 2026, Apple Inc. (“Apple”) consummated'
            )
        ).toBe(true);
        expect(headline.length).toBeLessThanOrEqual(200);
        expect(headline).not.toMatch(/\s$/);
        expect(text).toContain(headline);
        expect(text.split(headline)[1][0]).toBe(' ');
    });

    it('9.01 항목은 건너뛴다(Financial Statements and Exhibits가 제목이 되지 않는다)', () => {
        const text = [
            'Item 9.01. Financial Statements and Exhibits.',
            '',
            '(d) Exhibits. 99.1 Press release.',
            'Item 5.02. Departure of Directors.',
            '',
            'Jane Doe resigned as a director on November 1, 2026. More follows.',
        ].join('\n');
        expect(extractPrimaryHeadline(text)).toBe(
            'Jane Doe resigned as a director on November 1, 2026.'
        );
    });

    it('U.S.와 한 글자 이니셜의 마침표에서는 문장을 끊지 않는다', () => {
        const text =
            'Item 1.01. Entry.\n\nThe company sold U.S. Treasury notes to J. Smith for $5.5 million. Then more.';
        expect(extractPrimaryHeadline(text)).toBe(
            'The company sold U.S. Treasury notes to J. Smith for $5.5 million.'
        );
    });

    it('본문 없이 다음 항목이 바로 오면 그 항목은 건너뛴다', () => {
        const text =
            'Item 2.02. Results.\nItem 8.01. Other Events.\n\nThe board declared a dividend today.';
        expect(extractPrimaryHeadline(text)).toBe(
            'The board declared a dividend today.'
        );
    });

    it('Item 제목이 없는 6-K 표지는 첨부 목록 줄의 설명을 쓴다', () => {
        const text = [
            'FORM 6-K',
            'EXHIBIT INDEX',
            'Exhibit No. Description',
            '99.1 Press release dated November 10, 2026 — October 2026 Revenue Report',
        ].join('\n');
        expect(extractPrimaryHeadline(text)).toBe(
            'Press release dated November 10, 2026 — October 2026 Revenue Report'
        );
    });

    it('Exhibit 접두와 구분 기호가 있어도 설명만 뽑고, 설명이 짧으면 건너뛴다', () => {
        expect(
            extractPrimaryHeadline(
                'Exhibit 99.2: Announcement regarding the monthly return'
            )
        ).toBe('Announcement regarding the monthly return');
        expect(extractPrimaryHeadline('99.1 Press release')).toBeNull();
    });

    it('Item 본문이 있으면 첨부 목록보다 Item이 우선', () => {
        const text =
            'Item 8.01. Other Events.\n\nThe board approved a buyback today.\n99.1 Press release dated November 10, 2026';
        expect(extractPrimaryHeadline(text)).toBe(
            'The board approved a buyback today.'
        );
    });

    it('항목이 수만 개여도 스택이 늘지 않는다', () => {
        const text = Array.from(
            { length: 10_000 },
            () => 'Item 1.01. Entry.'
        ).join('\n');
        expect(extractPrimaryHeadline(text)).toBeNull();
    });

    it('조건에 맞는 항목이 없으면 null', () => {
        expect(extractPrimaryHeadline('')).toBeNull();
        expect(
            extractPrimaryHeadline('FORM 6-K\nReport of Foreign Private Issuer')
        ).toBeNull();
        expect(
            extractPrimaryHeadline(
                'Item 9.01. Financial Statements and Exhibits.\n\nExhibits.'
            )
        ).toBeNull();
        expect(extractPrimaryHeadline('Item 8.01. Other Events.')).toBeNull();
    });
    it('항목 제목이 빽빽한 큰 문서에서도 줄 수에 비례하는 시간만 쓴다', () => {
        // 본문 없는 항목 제목 20,000줄 — 제목마다 0번 줄부터 다시 훑으면 초 단위가 걸린다.
        const text = Array.from(
            { length: 20_000 },
            (_, i) => `Item ${1 + (i % 8)}.0${1 + (i % 5)} Title`
        ).join('\n');
        const started = performance.now();
        expect(extractPrimaryHeadline(text)).toBeNull();
        expect(performance.now() - started).toBeLessThan(1_500);
    });
});
