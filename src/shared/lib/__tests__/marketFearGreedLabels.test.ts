import { describe, expect, it } from 'vitest';
import koMessages from '@/../messages/ko.json';
import enMessages from '@/../messages/en.json';
import jaMessages from '@/../messages/ja.json';
import zhMessages from '@/../messages/zh.json';
import { MARKET_FEAR_GREED_FACTOR_KEYS } from '@y0ngha/siglens-core';

const CATALOGS = {
    ko: koMessages,
    en: enMessages,
    ja: jaMessages,
    zh: zhMessages,
};

/**
 * 팩터 라벨·설명은 카탈로그(`shared.lib.fearGreedFactor`)로 옮겼다 — 예전에는
 * `MARKET_FACTOR_LABEL`/`MARKET_FACTOR_DESCRIPTION`이 한국어 문자열 테이블이라
 * `/en/fear-greed`가 `시장 모멘텀`을 그대로 렌더했다.
 *
 * 그래서 이 테스트는 **한국어 문자열을 고정하지 않고**, 다섯 팩터 × 두 시장이
 * 네 로케일에 다 있는지를 본다. 새 팩터를 추가하고 번역을 빠뜨리면 실패한다.
 */
describe('market fear-greed 팩터 카탈로그', () => {
    const group = (locale: keyof typeof CATALOGS) =>
        (CATALOGS[locale].shared.lib as unknown as Record<string, unknown>)
            .fearGreedFactor as {
            label: Record<string, string>;
            descriptionUs: Record<string, string>;
            descriptionKr: Record<string, string>;
        };

    it.each(MARKET_FEAR_GREED_FACTOR_KEYS)(
        '%s: 라벨이 네 로케일에 다 있다',
        key => {
            for (const locale of Object.keys(CATALOGS) as Array<
                keyof typeof CATALOGS
            >) {
                const labels = group(locale).label;
                // `junk_bond`만 시장별로 이름이 갈린다(미국=하이일드, 한국=신용 스프레드).
                const names =
                    key === 'junk_bond'
                        ? ['junk_bond_us', 'junk_bond_kr']
                        : [key];
                for (const name of names) {
                    expect(labels[name], `${locale}: ${name}`).toBeTruthy();
                }
            }
        }
    );

    it.each(MARKET_FEAR_GREED_FACTOR_KEYS)(
        '%s: 설명이 두 시장 × 네 로케일에 다 있다',
        key => {
            for (const locale of Object.keys(CATALOGS) as Array<
                keyof typeof CATALOGS
            >) {
                expect(
                    group(locale).descriptionUs[key],
                    `${locale} us: ${key}`
                ).toBeTruthy();
                expect(
                    group(locale).descriptionKr[key],
                    `${locale} kr: ${key}`
                ).toBeTruthy();
            }
        }
    );

    it('비-ko 로케일에 한글이 남지 않았다', () => {
        for (const locale of ['en', 'ja', 'zh'] as const) {
            const g = group(locale);
            for (const table of [g.label, g.descriptionUs, g.descriptionKr]) {
                for (const [key, value] of Object.entries(table)) {
                    expect(value, `${locale}.${key}`).not.toMatch(/[가-힣]/);
                }
            }
        }
    });
});
