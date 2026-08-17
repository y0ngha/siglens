import { describe, it, expect } from 'vitest';
import { detectTruncatedBody } from '../lib/detectTruncatedBody';

describe('detectTruncatedBody', () => {
    describe('실측 절단 사례 (2026-08-17)', () => {
        it.each([
            // FMP news/stock — `...` 표식조차 없이 문장 중간에서 끊긴다.
            'Apple Inc. reported strong quarterly results. Institutional investors purchased 1,205 shares during the quarter. Apple makes',
            'Several other large investors also recently modified',
            'Apple accounts for about',
            // 네이버 description — 항상 말줄임으로 끝난다.
            '삼성전자가 10여년간 운영해온 사내 익명 게시판을 실명제로 전환한다. 익명성을 악용한 비방과 허위사실 유포 등으로 임직원 권리 침해가 이어진 데 따른 조치다. 지난달 시행된 개정 정보통신망법에 따라 사내...',
        ])('detects %#', body => {
            expect(detectTruncatedBody(body)).toBe(true);
        });
    });

    describe('완결된 본문', () => {
        it.each([
            'Apple Inc. reported Q2 revenue of $95B, surpassing analyst estimates.',
            '삼성전자가 반도체 부문 회복에 힘입어 시장 예상을 웃도는 실적을 냈다.',
            // 마침표 뒤 인용부호로 끝나는 정상 종료.
            'The CEO said "we will continue to grow."',
            // 닫는 괄호로 끝나는 경우.
            'Revenue rose 12% year over year (excluding currency effects).',
            // 물음표·느낌표.
            'Is Apple still a buy?',
            // 한국어 종결부호 변형.
            '삼성전자의 3분기 실적은 시장 기대를 넘어섰다。',
        ])('accepts %#', body => {
            expect(detectTruncatedBody(body)).toBe(false);
        });
    });

    describe('말줄임 표기', () => {
        it.each(['…', '...', '....'])(
            'treats trailing %s as truncated regardless of length',
            suffix => {
                // 말줄임은 명시적 신호라 길이 가드보다 우선한다.
                expect(detectTruncatedBody(`짧은 조각${suffix}`)).toBe(true);
            }
        );

        it('ignores trailing whitespace after the ellipsis', () => {
            expect(detectTruncatedBody('본문 앞부분...   ')).toBe(true);
        });
    });

    describe('본문 부재', () => {
        it.each([null, undefined, '', '   ', '\n\t'])(
            'returns false for %p — absence is handled separately',
            body => {
                // 본문이 없는 경우는 프롬프트가 이미 별도 규칙으로 다룬다.
                expect(detectTruncatedBody(body)).toBe(false);
            }
        );
    });

    describe('짧은 본문은 판정을 보류한다', () => {
        it('does not flag a short fragment lacking punctuation', () => {
            // 한 줄 헤드라인 요약은 종결부호가 없어도 원래 그런 형태일 수 있다.
            // 확실하지 않은 표시를 붙이면 그 표시의 신호 가치가 희석된다.
            expect(detectTruncatedBody('Apple beats estimates')).toBe(false);
        });

        it('flags the same shape once it is long enough to judge', () => {
            const long =
                'Apple beat analyst estimates across every reporting segment this quarter and management';
            expect(long.length).toBeGreaterThanOrEqual(40);
            expect(detectTruncatedBody(long)).toBe(true);
        });

        it('still flags a short fragment that carries an ellipsis', () => {
            expect(detectTruncatedBody('Apple beats...')).toBe(true);
        });

        it.each([
            'Apple accounts for about', // 실측 FMP 응답(24자)
            'Revenue grew by the',
            '실적은 시장 기대를 웃돌았다 and',
        ])('flags %p — a dangling function word needs an object', body => {
            // 길이 가드만 두면 이런 실측 사례를 놓친다. 전치사·관사·접속사로 끝나면
            // 뒤에 올 말이 잘린 것이라 길이와 무관하게 절단이다.
            expect(detectTruncatedBody(body)).toBe(true);
        });

        it('does not flag a headline-style noun phrase', () => {
            // 기능어 규칙이 짧은 정상 본문까지 잡으면 표시의 신호 가치가 희석된다.
            expect(detectTruncatedBody('Apple Q2 earnings beat')).toBe(false);
        });
    });
});
