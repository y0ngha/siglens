import { describe, expect, it } from 'vitest';

import koMessages from '@/../messages/ko.json';
import {
    buildAriaLabel,
    buildAriaLabelCurrentOnly,
} from '@/widgets/portfolio-position/utils/positionBuildingNotes';
import { computePosition } from '@/widgets/portfolio-position/utils/positionGeometry';

/** 실제 ko 카탈로그를 읽는 번역자 — 스텁이면 키 누락(ariaSummaryCurrentOnly)이 조용히 통과한다. */
const tPos = (key: string, values?: Record<string, string | number>) => {
    const table = koMessages.widgets['portfolio-position']
        .positionNote as Record<string, string>;
    const raw = table[key];
    if (raw === undefined) throw new Error(`missing positionNote.${key}`);
    return Object.entries(values ?? {}).reduce(
        (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)),
        raw
    );
};

describe('buildAriaLabelCurrentOnly', () => {
    const model = computePosition({
        low52w: 100,
        high52w: 200,
        current: 130,
        avg: 130,
    });

    it('평단·수익률 없이 현재가·범위 위치·층 안내만 담는다', () => {
        expect(model).not.toBeNull();
        const label = buildAriaLabelCurrentOnly(
            'AAPL',
            model!,
            '$130',
            '2층 · 중층',
            tPos
        );
        expect(label).toBe(
            'AAPL 현재가 위치: 현재가 $130, 최근 범위의 30% 지점, 2층 · 중층'
        );
    });

    it('평단 요약(buildAriaLabel)과 다른 키를 쓴다 — 평단 문구가 섞이지 않는다', () => {
        const withAvg = buildAriaLabel(
            'AAPL',
            model!,
            '$130',
            '$130',
            '2층 · 중층',
            tPos
        );
        const currentOnly = buildAriaLabelCurrentOnly(
            'AAPL',
            model!,
            '$130',
            '2층 · 중층',
            tPos
        );
        expect(withAvg).toContain('평단');
        expect(currentOnly).not.toContain('평단');
    });
});
