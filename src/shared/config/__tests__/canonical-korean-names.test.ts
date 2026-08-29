import { describe, expect, it } from 'vitest';
import { CANONICAL_KOREAN_NAMES } from '@/shared/config/canonical-korean-names';
import {
    CURATED_KOREAN_NAMES,
    POPULAR_TICKERS,
} from '@/shared/config/popular-tickers';
import { SECTOR_ETFS, SECTOR_STOCKS } from '@/shared/config/dashboard-tickers';

const DASHBOARD_NAMES = new Map<string, string>([
    ...SECTOR_STOCKS.map(s => [s.symbol, s.koreanName] as const),
    ...SECTOR_ETFS.map(e => [e.symbol, e.koreanName] as const),
]);

describe('CANONICAL_KOREAN_NAMES', () => {
    /**
     * **이 파일의 존재 이유.** 2026-08-24 실측에서 같은 종목이 홈 카드 / 마켓
     * 대시보드 / 종목 페이지 제목에서 각각 다른 이름으로 보였다(`LAES` →
     * 세알시큐리티 / SEALSQ / 씰스큐). 정본을 정해 놓고 다른 표면이 조용히
     * 갈라지는 것을 막는 게 이 스위트의 목적이다.
     *
     * DB(`asset_translations`)는 `getAssetInfo`의 오버라이드가 처리하므로 여기서
     * 검증할 수 없다 — 대신 상수 두 개를 고정한다.
     */
    it('홈 카드·마켓 대시보드가 정본과 어긋나지 않는다', () => {
        const mismatches = [...CANONICAL_KOREAN_NAMES].flatMap(
            ([symbol, canonical]) => {
                const home = CURATED_KOREAN_NAMES.get(symbol);
                const dashboard = DASHBOARD_NAMES.get(symbol);
                return [
                    ...(home !== undefined && home !== canonical
                        ? [`${symbol} 홈: "${home}" ≠ "${canonical}"`]
                        : []),
                    ...(dashboard !== undefined && dashboard !== canonical
                        ? [
                              `${symbol} 대시보드: "${dashboard}" ≠ "${canonical}"`,
                          ]
                        : []),
                ];
            }
        );
        expect(mismatches).toEqual([]);
    });

    it('정본 대상 심볼은 전부 색인 유니버스 안에 있다', () => {
        const universe = new Set<string>(POPULAR_TICKERS);
        const missing = [...CANONICAL_KOREAN_NAMES.keys()].filter(
            symbol => !universe.has(symbol)
        );
        expect(missing).toEqual([]);
    });

    it('빈 이름이나 앞뒤 공백이 없다', () => {
        for (const [symbol, name] of CANONICAL_KOREAN_NAMES) {
            expect(name, symbol).toBe(name.trim());
            expect(name.length, symbol).toBeGreaterThan(0);
        }
    });

    /**
     * 이 맵은 **오류 교정용**이지 표기 통일용이 아니다. 대시보드가 좁은 카드
     * 그리드라 짧은 라벨(`기술`)을 쓰고 DB가 완전한 이름(`기술 섹터 ETF`)을 쓰는
     * 것은 의도된 차이이고, 여기 넣어 강제하면 카드가 말줄임으로 뭉개진다.
     * 섹터 ETF를 통째로 넣는 회귀를 막는다.
     */
    it('섹터 ETF의 짧은 라벨을 강제하지 않는다 (길이 예산은 오류가 아님)', () => {
        const sectorEtfSymbols = new Set(SECTOR_ETFS.map(e => e.symbol));
        const overridden = [...CANONICAL_KOREAN_NAMES.keys()].filter(symbol =>
            sectorEtfSymbols.has(symbol)
        );
        expect(overridden).toEqual([]);
    });
});
