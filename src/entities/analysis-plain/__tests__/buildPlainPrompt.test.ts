import { readFileSync } from 'node:fs';
import { globSync } from 'glob';
import { describe, expect, it } from 'vitest';
import { buildPlainPrompt } from '../lib/buildPlainPrompt';
import { findUnsupportedNumbers } from '../lib/guardPlainText';

const entries = [
    { path: 'summary', text: 'MACD 골든크로스 발생' },
    { path: 'keyLevels.support.0.reason', text: 'EMA20 지지' },
];
const facts = { symbol: 'AAPL', trend: 'bullish', numbers: [1, 2] };

describe('buildPlainPrompt', () => {
    it('경로를 키로 하는 prose 맵을 싣는다', () => {
        const prompt = buildPlainPrompt({ entries, facts, locale: 'ko' });
        expect(prompt).toContain('"keyLevels.support.0.reason"');
        expect(prompt).toContain('MACD 골든크로스 발생');
    });

    it('facts를 그대로 직렬화한다', () => {
        expect(buildPlainPrompt({ entries, facts, locale: 'ko' })).toContain(
            JSON.stringify(facts)
        );
    });

    it('로케일별 출력 언어를 지정한다', () => {
        expect(buildPlainPrompt({ entries, facts, locale: 'ja' })).toContain(
            '일본어로 쓰세요'
        );
    });

    it('알 수 없는 로케일은 한국어로 떨어진다', () => {
        expect(buildPlainPrompt({ entries, facts, locale: 'xx' })).toContain(
            '한국어로 쓰세요'
        );
    });

    it('재시도 힌트는 넘겼을 때만 실린다', () => {
        const base = buildPlainPrompt({ entries, facts, locale: 'ko' });
        expect(base).not.toContain('이전 응답이');
        expect(
            buildPlainPrompt({
                entries,
                facts,
                locale: 'ko',
                retryHint: '이전 응답이 입력에 없는 숫자를 포함했습니다.',
            })
        ).toContain('이전 응답이 입력에 없는 숫자를 포함했습니다.');
    });

    /**
     * 이 프로젝트에는 스킬이 82개 있고 거기서 파생되는 지표·전략·패턴 이름이 108개다.
     * 프롬프트가 그중 하나라도 이름을 부르기 시작하면 목록이 되고, 목록은 스킬이
     * 추가될 때마다 반드시 뒤처진다. 실측에서 목록은 효과도 없었다(§9.2).
     *
     * 이 테스트가 그 규율을 고정한다. 새 스킬이 추가되면 자동으로 검사 대상이 늘어난다.
     */
    it('스킬 카탈로그의 이름을 하나도 언급하지 않는다', () => {
        const catalogTerms = new Set<string>();
        for (const file of globSync('skills/**/*.md')) {
            const raw = readFileSync(file, 'utf-8');
            const name = /^name:\s*(.+)$/m.exec(raw)?.[1]?.trim();
            if (name === undefined) continue;
            const core = name.replace(/\s*(Signal\s*)?Guide$/, '').trim();
            if (core.length >= 2) catalogTerms.add(core);
            for (const token of core.match(/\b[A-Z][A-Z0-9]{1,}\b/g) ?? []) {
                catalogTerms.add(token);
            }
        }
        expect(catalogTerms.size).toBeGreaterThan(50);

        // 프롬프트 규칙 본문만 검사한다 — prose/facts는 호출자가 넣은 분석 내용이라
        // 당연히 지표 이름을 담는다.
        const prompt = buildPlainPrompt({
            entries: [{ path: 'summary', text: '' }],
            facts: { symbol: 'AAPL', numbers: [] },
            locale: 'ko',
        });
        const rules = prompt.slice(0, prompt.indexOf('prose:'));

        const leaked = [...catalogTerms].filter(term =>
            /^[\x20-\x7E]+$/.test(term)
                ? new RegExp(
                      `\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`
                  ).test(rules)
                : rules.includes(term)
        );
        expect(leaked).toEqual([]);
    });

    /** 분량 제한도 두지 않는다 — 타입마다 적정 분량이 다르다(실측 압축률 37~105%). */
    it('글자 수·문단 수를 지정하지 않는다', () => {
        const prompt = buildPlainPrompt({ entries, facts, locale: 'ko' });
        const rules = prompt.slice(0, prompt.indexOf('prose:'));
        expect(rules).not.toMatch(/\d+\s*자\s*(이상|이하)/);
        expect(rules).not.toMatch(/\d+\s*~\s*\d+\s*문단/);
        expect(rules).not.toMatch(/최대\s*\d+\s*문장/);
    });
});

/**
 * 프롬프트가 가르치는 반올림과 가드가 통과시키는 반올림은 **같아야 한다.**
 *
 * 한때 예시가 `121980.69948682484 → 121,980`(버림)이었는데, 가드는
 * `Math.round`(가까운 쪽)만 통과시킨다 — `121981`이다. 모델이 예시를 그대로
 * 따르면 가드가 그 문장을 지어낸 숫자로 보고 버려서, 정작 그 예시가 지키려던
 * 손절값이 사라진다.
 */
describe('반올림 예시가 가드의 관용 규칙과 일치한다', () => {
    it('예시 값이 Math.round 결과와 같다', () => {
        const prompt = buildPlainPrompt({
            entries: [{ path: 'summaryKo', text: '요약' }],
            facts: { symbol: 'AAPL', numbers: [] },
            locale: 'ko',
        });

        const example = prompt.match(/손절 기준 (\d+\.\d+) → "([\d,]+)원/);
        expect(example).not.toBeNull();

        const source = Number(example![1]);
        const shown = Number(example![2].replace(/,/g, ''));
        expect(shown).toBe(Math.round(source));

        // 가드가 실제로 그 표기를 통과시키는지도 확인한다.
        expect(findUnsupportedNumbers(String(shown), [source])).toEqual([]);
    });
});
