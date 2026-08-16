import { describe, expect, it } from 'vitest';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { applicableTabsFor, buildPrewarmUniverse } from '../lib/applicability';

describe('applicableTabsFor', () => {
    it('크립토는 technical/overall/news만', () => {
        expect(applicableTabsFor(POPULAR_CRYPTOS[0])).toEqual([
            'technical',
            'overall',
            'news',
        ]);
    });

    it('옵션 상장 주식은 7탭 전부 (options 포함)', () => {
        expect(applicableTabsFor('AAPL')).toHaveLength(7);
        expect(applicableTabsFor('AAPL')).toContain('options');
    });

    it('옵션 미상장 주식(TCEHY)은 options 제외 6탭', () => {
        expect(applicableTabsFor('TCEHY')).toHaveLength(6);
        expect(applicableTabsFor('TCEHY')).not.toContain('options');
    });

    it('화이트리스트 밖 심볼은 빈 배열', () => {
        expect(applicableTabsFor('ZZZQ_NOT_REAL')).toEqual([]);
    });

    it('소문자 입력도 정규화 처리', () => {
        expect(applicableTabsFor('aapl')).toHaveLength(7);
    });
});

describe('buildPrewarmUniverse', () => {
    // 실패 시 상수 목록 변경 — 스펙 §5 수치도 함께 갱신
    it('전체 유닛 수 = 264×7 + 1×6 + 20×5 + 29×3 = 2041 (spec §5 실측)', () => {
        const units = buildPrewarmUniverse().reduce(
            (n, u) => n + u.tabs.length,
            0
        );
        expect(units).toBe(2041);
    });

    // 실패 시 상수 목록 변경 — 스펙 §5 수치도 함께 갱신
    it('심볼 수 = 314 (POPULAR_TICKERS 285 + POPULAR_CRYPTOS 29)', () => {
        expect(buildPrewarmUniverse()).toHaveLength(314);
    });

    it('한국 종목은 options·congress를 prewarm하지 않는다', () => {
        // 국내에는 개별주식옵션 시장도 공직자 매매 공시 API도 없다 —
        // KR_EQUITY_DESCRIPTOR.tabs와 같은 이유로 제외된다.
        const tabs = applicableTabsFor('005930.KS');
        expect(tabs).not.toContain('options');
        expect(tabs).not.toContain('congress');
        expect(tabs).toEqual([
            'technical',
            'overall',
            'fundamental',
            'financials',
            'news',
        ]);
    });
});
