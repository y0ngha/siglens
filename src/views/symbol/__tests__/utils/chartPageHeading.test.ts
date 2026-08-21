import { describe, it, expect } from 'vitest';
import enMessages from '../../../../../messages/en.json';
import koMessages from '../../../../../messages/ko.json';
import { CHART_PAGE_HEADING_KEY } from '@/views/symbol/utils/chartPageHeading';
import clientKeys from '../../../../../messages/_meta/clientKeys.json';

/**
 * h1 메시지가 **양쪽 로케일에서 완성 문장**이고, 그 키가 실제로 종목 라우트의
 * 클라이언트 페이로드에 실리는지 본다.
 *
 * 두 번째 단언이 핵심이다. 한때 이 파일이 `t()`를 직접 불렀는데, 이 파일에는
 * 번역자 선언이 없어 추출기가 키를 못 봤고 — `ko.json`에는 남아 `i18n:verify`가
 * 통과하는 채로 — **가시 h1이 원시 키 문자열로 렌더**됐다. 전 로케일, ko 포함.
 */
describe('차트 페이지 h1', () => {
    const heading = (catalog: unknown) =>
        (
            catalog as {
                views: { symbol: { chartPageHeading: Record<string, string> } };
            }
        ).views.symbol.chartPageHeading.heading;

    it('ko는 " 차트 분석" suffix를 쓴다', () => {
        expect(heading(koMessages)).toBe('{v0} 차트 분석');
    });

    it('en은 템플릿까지 영어다', () => {
        expect(heading(enMessages)).toBe('{v0} Chart Analysis');
        expect(heading(enMessages)).not.toMatch(/[가-힣]/);
    });

    it('키가 [symbol] 라우트 페이로드에 실린다', () => {
        const entry = (
            clientKeys as {
                routes: Record<
                    string,
                    { keys: string[]; wideNamespaces: string[] }
                >;
            }
        ).routes['[symbol]']!;
        const full = `views.symbol.${CHART_PAGE_HEADING_KEY}`;

        expect(
            entry.keys.includes(full) ||
                entry.wideNamespaces.some(ns => full.startsWith(`${ns}.`))
        ).toBe(true);
    });
});
