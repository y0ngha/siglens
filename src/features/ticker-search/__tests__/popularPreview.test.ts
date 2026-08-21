import koMessages from '@/../messages/ko.json';
import enMessages from '@/../messages/en.json';
import jaMessages from '@/../messages/ja.json';
import zhMessages from '@/../messages/zh.json';
import { describe, expect, it } from 'vitest';
import { CRYPTO_CATEGORIES } from '@/shared/config/crypto-categories';
import { TICKER_CATEGORIES } from '@/shared/config/popular-tickers';
import { POPULAR_PREVIEW_GROUPS } from '@/features/ticker-search/lib/popularPreview';

/**
 * 이 목록의 계약은 두 가지다 — **세 자산군을 대표할 것**, 그리고 **손으로 적은 네 번째
 * 목록이 되지 않을 것**. 아래 테스트가 그 둘을 고정한다.
 */
const CATALOGS = {
    ko: koMessages,
    en: enMessages,
    ja: jaMessages,
    zh: zhMessages,
};

describe('POPULAR_PREVIEW_GROUPS', () => {
    it('미국·한국·암호화폐를 모두 담는다', () => {
        // 첫 방문자(최근 검색 없음)가 보는 유일한 화면이다. 미국 종목만 있으면
        // 한국 주식·코인 사용자에게는 "입력 전에도 볼 게 있다"가 성립하지 않는다.
        // 라벨은 `shared.config.nav.region` 키다 — 문구가 아니라 키를 고정한다.
        // 문구를 고정하면 이 목록이 네 로케일로 갈리는 순간 테스트가 ko에만 묶인다.
        expect(POPULAR_PREVIEW_GROUPS.map(g => g.labelKey)).toEqual([
            'us',
            'kr',
            'crypto',
        ]);
    });

    it('모든 심볼이 기존 config에서 유래한다', () => {
        // 원본에서 종목이 빠지면 여기서 먼저 깨진다 — 드리프트 가드.
        const known = new Set([
            ...TICKER_CATEGORIES.flatMap(c => c.items.map(i => i.symbol)),
            ...CRYPTO_CATEGORIES.flatMap(c => c.items.map(i => i.symbol)),
        ]);
        for (const group of POPULAR_PREVIEW_GROUPS) {
            for (const symbol of group.items) {
                expect(known.has(symbol)).toBe(true);
            }
        }
    });

    /**
     * 표시 이름은 이 파일이 갖고 있지 않다 — `shared.assetName` 카탈로그가 정한다.
     * 그래서 검사할 것은 "이름이 원본 config와 같은가"가 아니라 **"네 로케일 전부에
     * 그 심볼이 있는가"**다. 없으면 폴백이 티커를 그리는데, 화면은 멀쩡해 보여
     * 눈으로는 못 잡는다.
     */
    it.each(['ko', 'en', 'ja', 'zh'] as const)(
        '%s 카탈로그에 인기 종목 이름이 다 있다',
        locale => {
            const table = CATALOGS[locale].shared.assetName as Record<
                string,
                string
            >;
            for (const group of POPULAR_PREVIEW_GROUPS) {
                for (const symbol of group.items) {
                    // next-intl은 `.`를 중첩 구분자로 쓴다 — `useAssetLabel`과 같은 치환.
                    const key = symbol.replace(/\./g, '_');
                    expect(table[key], `${locale}: ${symbol}`).toBeTruthy();
                }
            }
        }
    );

    /**
     * 오버레이는 `shared.assetName`(166키)이 아니라 9키짜리
     * `features.ticker-search.popularName`을 쓴다 — 그 표는 전 라우트 크롬에
     * 실리므로 큰 표를 끌어오면 first-load가 통째로 무거워진다
     * (`clientKeyCoverage.test.ts`). 대신 두 표가 갈릴 수 있으므로 여기서 묶는다.
     */
    it.each(['ko', 'en', 'ja', 'zh'] as const)(
        '%s: popularName 표가 assetName과 같은 값이다',
        locale => {
            const wide = CATALOGS[locale].shared.assetName as Record<
                string,
                string
            >;
            const narrow = (
                CATALOGS[locale].features['ticker-search'] as unknown as {
                    popularName: Record<string, string>;
                }
            ).popularName;
            const symbols = POPULAR_PREVIEW_GROUPS.flatMap(g => g.items);
            expect(Object.keys(narrow).toSorted()).toEqual(
                symbols.map(s => s.replace(/\./g, '_')).toSorted()
            );
            for (const symbol of symbols) {
                const key = symbol.replace(/\./g, '_');
                expect(narrow[key], `${locale}: ${symbol}`).toBe(wide[key]);
            }
        }
    );

    it('비-ko 카탈로그의 인기 종목 이름에 한글이 없다', () => {
        for (const locale of ['en', 'ja', 'zh'] as const) {
            const table = CATALOGS[locale].shared.assetName as Record<
                string,
                string
            >;
            for (const group of POPULAR_PREVIEW_GROUPS) {
                for (const symbol of group.items) {
                    const key = symbol.replace(/\./g, '_');
                    expect(table[key], `${locale}: ${symbol}`).not.toMatch(
                        /[가-힣]/
                    );
                }
            }
        }
    });

    it('한국 그룹은 실제 국내 종목을 담는다', () => {
        const kr = POPULAR_PREVIEW_GROUPS.find(g => g.labelKey === 'kr');
        expect(kr?.items.every(s => /\.(KS|KQ)$/.test(s))).toBe(true);
    });
});
