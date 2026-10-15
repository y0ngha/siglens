import { describe, expect, it } from 'vitest';
import { CANONICAL_KOREAN_NAMES } from '@/shared/config/canonical-korean-names';
import { KOREAN_SEARCH_ALIASES } from '@/shared/config/korean-search-aliases';

describe('KOREAN_SEARCH_ALIASES', () => {
    it('별칭은 정본 한글명에 이미 들어 있는 표기가 아니다', () => {
        // 정본의 부분 문자열인 별칭은 매칭에 아무것도 더하지 않는다 — 넣는 기준 위반.
        const redundant = [...KOREAN_SEARCH_ALIASES].flatMap(
            ([symbol, aliases]) => {
                const canonical = CANONICAL_KOREAN_NAMES.get(symbol);
                if (canonical === undefined) return [];
                return aliases
                    .filter(alias => canonical.includes(alias))
                    .map(alias => `${symbol}: "${alias}"`);
            }
        );
        expect(redundant).toEqual([]);
    });

    it('별칭은 공백 없는 한글이다', () => {
        // 공백·영문 차이는 매칭이 따로 처리한다(`searchByKoreanName`).
        const invalid = [...KOREAN_SEARCH_ALIASES].flatMap(
            ([symbol, aliases]) =>
                aliases
                    .filter(alias => !/^[가-힣]+$/.test(alias))
                    .map(alias => `${symbol}: "${alias}"`)
        );
        expect(invalid).toEqual([]);
    });
});
