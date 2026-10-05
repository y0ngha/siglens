import { describe, expect, it } from 'vitest';
import {
    buildSnapshotMetaDescription,
    buildTitleSubject,
    SEO_SNAPSHOT_DESCRIPTION_MAX_LENGTH,
} from '../seo';

const LABEL = '주가 분석';

describe('buildTitleSubject — 이중 괄호 방지', () => {
    it('한글명이 `)`로 끝나면 괄호를 겹치지 않고 공백으로 잇는다', () => {
        expect(buildTitleSubject('005935.KS', '삼성전자우(보통주)')).toBe(
            '삼성전자우(보통주) 005935'
        );
    });

    it('일반 이름은 `이름(티커)`, 국내 종목은 접미사를 뗀 코드를 쓴다', () => {
        expect(buildTitleSubject('AAPL', '애플')).toBe('애플(AAPL)');
        expect(buildTitleSubject('005930.KS', '삼성전자')).toBe(
            '삼성전자(005930)'
        );
    });
});

describe('buildSnapshotMetaDescription — 짧은 주어와 문장 단위 절단', () => {
    it('접두는 주어 + 탭 라벨이고 긴 표시명을 쓰지 않는다', () => {
        const result = buildSnapshotMetaDescription(
            'technical',
            { summary: '추세는 상승입니다.' },
            '애플(AAPL)',
            null,
            'ko',
            LABEL
        );
        expect(result).toBe('애플(AAPL) 주가 분석 — 추세는 상승입니다.');
    });

    it('원문 경로도 160자 안에서 온전한 문장까지만 담는다(문장 중간에서 끊지 않는다)', () => {
        const sentence =
            '이 종목은 최근 거래량이 늘며 주요 이동평균선 위에 있습니다.';
        const summary = Array.from({ length: 12 }, () => sentence).join(' ');
        const result = buildSnapshotMetaDescription(
            'technical',
            { summary },
            '애플(AAPL)',
            null,
            'ko',
            LABEL
        )!;

        expect([...result].length).toBeLessThanOrEqual(
            SEO_SNAPSHOT_DESCRIPTION_MAX_LENGTH
        );
        expect(result.endsWith('습니다.')).toBe(true);
        expect(result).not.toContain('…');
        // 120자를 넘겨 둘째·셋째 문장까지 들어간다 — 예전 상한(120)이면 잘렸다.
        expect([...result].length).toBeGreaterThan(120);
    });

    it('첫 문장조차 예산에 안 들어갈 때만 `…`로 자른다', () => {
        const result = buildSnapshotMetaDescription(
            'technical',
            { summary: '가'.repeat(400) },
            '애플(AAPL)',
            null,
            'ko',
            LABEL
        )!;
        expect(result.endsWith('…')).toBe(true);
        expect([...result].length).toBeLessThanOrEqual(
            SEO_SNAPSHOT_DESCRIPTION_MAX_LENGTH
        );
    });
});
