import { describe, expect, it } from 'vitest';
import {
    buildEconomyFaq,
    buildEconomyKrFaq,
    buildEconomyPageJsonLd,
} from '@/app/[locale]/economy/_lib/economyJsonLd';
import type { SeoTranslator } from '@/shared/lib/seo';

/** 키(값이 있으면 `키:v0`)를 그대로 돌려주는 번역자 — 어떤 키·값으로 풀었는지 단언한다. */
const t: SeoTranslator = (key, values) =>
    values === undefined ? key : `${key}:${String(values.v0)}`;

describe('buildEconomyPageJsonLd', () => {
    const jsonLd = buildEconomyPageJsonLd({
        path: '/economy/kr',
        title: 'Korea economy',
        description: 'Korean macro indicators.',
        locale: 'en',
    });

    it('WebPage는 로케일 URL과 브랜드를 붙인 이름을 쓴다', () => {
        expect(jsonLd.webPage).toMatchObject({
            '@type': 'WebPage',
            url: 'https://siglens.io/en/economy/kr',
            name: 'Korea economy | SIGLENS',
            description: 'Korean macro indicators.',
        });
    });

    it('WebPage에 dateModified를 싣지 않는다', () => {
        expect(jsonLd.webPage).not.toHaveProperty('dateModified');
    });

    it('breadcrumb 마지막 마디는 브랜드 없는 제목과 로케일 URL이다', () => {
        // 홈 마디는 `buildBreadcrumbJsonLd`가 앞에 붙인다 — 이 라우트가 넘긴 마디는 그 다음이다.
        expect(jsonLd.breadcrumb).toMatchObject({
            itemListElement: [
                expect.anything(),
                {
                    name: 'Korea economy',
                    item: 'https://siglens.io/en/economy/kr',
                },
            ],
        });
    });
});

describe('buildEconomyFaq', () => {
    it('네 문항의 답변에 갱신 주기를 값으로 넘긴다', () => {
        expect(buildEconomyFaq(t, 24)).toEqual(
            [0, 1, 2, 3].map(i => ({
                question: `economy.us.faq${i}q`,
                answer: `economy.us.faq${i}a:24`,
            }))
        );
    });
});

describe('buildEconomyKrFaq', () => {
    it('세 문항을 kr 키로 만든다', () => {
        expect(buildEconomyKrFaq(t)).toEqual(
            [0, 1, 2].map(i => ({
                question: `economy.kr.faq${i}q`,
                answer: `economy.kr.faq${i}a`,
            }))
        );
    });
});
