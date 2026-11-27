import { describe, expect, it } from 'vitest';
import en from '../../../../messages/en.json';
import ja from '../../../../messages/ja.json';
import ko from '../../../../messages/ko.json';
import zh from '../../../../messages/zh.json';

type Catalog = Record<string, unknown>;

const CATALOGS: Record<string, Catalog> = {
    ko: ko.widgets['agent-chat'].sinceEarlier,
    en: en.widgets['agent-chat'].sinceEarlier,
    ja: ja.widgets['agent-chat'].sinceEarlier,
    zh: zh.widgets['agent-chat'].sinceEarlier,
};

function flat(object: Catalog, prefix = ''): [string, string][] {
    return Object.entries(object).flatMap(([key, value]) =>
        typeof value === 'string'
            ? [[`${prefix}${key}`, value] as [string, string]]
            : flat(value as Catalog, `${prefix}${key}.`)
    );
}

const placeholders = (text: string): string[] =>
    [...text.matchAll(/\{(\w+)/g)].map(m => m[1]).toSorted();

describe('"달라진 점" 카드 문구', () => {
    const koEntries = flat(CATALOGS.ko);

    it.each(Object.entries(CATALOGS))(
        '%s: 키 집합과 자리표시자가 ko와 같다',
        (_locale, catalog) => {
            const entries = new Map(flat(catalog));
            expect([...entries.keys()].toSorted()).toEqual(
                koEntries.map(([key]) => key).toSorted()
            );
            for (const [key, koValue] of koEntries)
                expect(placeholders(entries.get(key) ?? ''), key).toEqual(
                    placeholders(koValue)
                );
        }
    );

    it.each(Object.entries(CATALOGS))(
        '%s: 줄표(—, –)와 가운뎃점(·, ・)을 쓰지 않는다',
        (_locale, catalog) => {
            for (const [key, value] of flat(catalog))
                expect(value, key).not.toMatch(/[—–·・]/);
        }
    );

    it('권유·판단 어휘(매수, 매도, 손절, 추천, 기회, 사세요)를 쓰지 않는다 (기술적 사실만 말한다)', () => {
        const banned = /매수|매도|손절|추천|기회|사세요|파세요/;
        for (const [key, value] of koEntries) {
            // 신호 이름은 기존 카탈로그의 공개 용어라 제외한다.
            if (key.startsWith('signal.')) continue;
            expect(value, key).not.toMatch(banned);
        }
    });

    it('추세 문장은 라벨 뒤에 조사를 붙이지 않는다(공용 라벨의 받침이 제각각이다)', () => {
        expect(CATALOGS.ko.trend).toContain('{to} 상태로');
        expect(CATALOGS.ko.trend).not.toMatch(
            /\{(to|from)\}(으로|로|은|는|이|가|을|를)/
        );
    });

    it('추세·신호 이름은 공용 카탈로그를 쓰고 이 카드가 따로 두지 않는다', () => {
        for (const catalog of Object.values(CATALOGS)) {
            expect(Object.keys(catalog)).not.toContain('trendBullish');
            expect(Object.keys(catalog.signal as Catalog)).toEqual(['line']);
        }
    });

    it('askLabel은 눈에 보이는 버튼 글자를 이어서 담는다 (WCAG 2.5.3)', () => {
        const visible: Record<string, string> = {
            ko: '달라진 점 물어보기',
            en: 'Ask what changed',
            ja: '変化を質問する',
            zh: '询问变化',
        };
        for (const [locale, catalog] of Object.entries(CATALOGS)) {
            expect(catalog.ask, locale).toBe(visible[locale]);
            expect(catalog.askLabel as string, locale).toContain(
                visible[locale]
            );
        }
    });

    it('한 줄 문구에는 줄바꿈과 앞뒤 공백이 없다', () => {
        for (const catalog of Object.values(CATALOGS))
            for (const [key, value] of flat(catalog)) {
                expect(value, key).toBe(value.trim());
                expect(value, key).not.toMatch(/\n/);
            }
    });

    it('날짜가 있는 줄은 날짜(기준일)를 자리표시자로 싣는다 (CS-18)', () => {
        for (const key of [
            'trend',
            'signal.line',
            'supportBroken',
            'supportRegained',
            'resistanceBroken',
            'resistanceLost',
            'planInZone',
            'planAbove',
            'planBelow',
            'planStopped',
            'planNoSetup',
            'noneWithLevels',
            'noneWithoutLevels',
        ]) {
            const entries = new Map(koEntries);
            expect(entries.get(key), key).toContain('{date}');
        }
    });
});
