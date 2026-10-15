import { describe, expect, it } from 'vitest';
import { CANONICAL_KOREAN_NAMES } from '@/shared/config/canonical-korean-names';
import { KOREAN_SEARCH_ALIASES } from '@/shared/config/korean-search-aliases';
import { koreanSearchKey, spellLatinLetters } from '../../lib/koreanSearchKey';
import { rankByRelevance } from '../../lib/searchRelevance';

describe('koreanSearchKey', () => {
    it('대소문자와 공백을 지운다', () => {
        expect(koreanSearchKey('AST 스페이스모바일')).toBe(
            koreanSearchKey('ast스페이스모바일')
        );
    });

    it.each([
        ['써클', '서클'],
        ['씰스큐', '실스큐'],
        ['까르푸', '가르푸'],
        ['빠빠존스', '바바존스'],
        ['짜이', '자이'],
        ['따따', '다다'],
    ])('된소리 초성을 예사소리로 접는다 (%s = %s)', (a, b) => {
        expect(koreanSearchKey(a)).toBe(koreanSearchKey(b));
    });

    it.each([
        ['애플', '에플'],
        ['얘기', '예기'],
        ['왜이브', '웨이브'],
        ['쇠', '쉐'],
    ])('구별되지 않는 모음을 접는다 (%s = %s)', (a, b) => {
        expect(koreanSearchKey(a)).toBe(koreanSearchKey(b));
    });

    it('고유어 최소쌍도 접히지만, 정확히 일치한 결과가 먼저 온다', () => {
        // 감수한 대가를 고정한다 — `싸`는 `사`와 같은 키가 된다.
        expect(koreanSearchKey('싸이')).toBe(koreanSearchKey('사이'));
        const ranked = rankByRelevance(
            [
                { symbol: 'PLAIN', name: 'Plain', koreanName: '사이언스' },
                { symbol: 'TENSE', name: 'Tense', koreanName: '싸이언스' },
            ],
            '싸이'
        );
        expect(ranked.map(r => r.symbol)).toEqual(['TENSE', 'PLAIN']);
    });

    it('받침과 다른 모음은 그대로 둔다', () => {
        expect(koreanSearchKey('엑손')).not.toBe(koreanSearchKey('엑슨'));
        expect(koreanSearchKey('삼성')).not.toBe(koreanSearchKey('산성'));
        // 종성 ㅆ은 접지 않는다 — 초성만 대상이다.
        expect(koreanSearchKey('있')).toBe('있');
    });

    it('한글이 아닌 문자는 그대로 둔다', () => {
        expect(koreanSearchKey('SK하이닉스 2X')).toBe('sk하이닉스2x');
    });
});

describe('spellLatinLetters', () => {
    it('영문 약어를 글자 이름으로 읽는다', () => {
        expect(spellLatinLetters('SK하이닉스')).toBe('에스케이하이닉스');
        expect(spellLatinLetters('LG에너지솔루션')).toBe('엘지에너지솔루션');
        expect(spellLatinLetters('IBM')).toBe('아이비엠');
    });

    it('영문이 없으면 null', () => {
        expect(spellLatinLetters('삼성전자')).toBeNull();
    });
});

describe('KOREAN_SEARCH_ALIASES', () => {
    it('별칭은 매칭 규칙이 이미 잡는 표기가 아니다', () => {
        // 정본(과 그 글자 읽기)의 검색 키에 이미 들어 있는 별칭은 매칭에 아무것도
        // 더하지 않는다 — 별칭 파일의 "넣는 기준" 위반.
        const redundant = [...KOREAN_SEARCH_ALIASES].flatMap(
            ([symbol, aliases]) => {
                const canonical = CANONICAL_KOREAN_NAMES.get(symbol);
                if (canonical === undefined) return [];
                const keys = [canonical, spellLatinLetters(canonical) ?? '']
                    .filter(Boolean)
                    .map(koreanSearchKey);
                return aliases
                    .filter(alias =>
                        keys.some(k => k.includes(koreanSearchKey(alias)))
                    )
                    .map(alias => `${symbol}: "${alias}"`);
            }
        );
        expect(redundant).toEqual([]);
    });
});
