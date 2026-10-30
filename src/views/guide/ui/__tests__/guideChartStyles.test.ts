import { describe, expect, it } from 'vitest';
import type { OverlayLabelColour } from '@/views/guide/lib/demoChartLayout';
import { overlayLabelClass } from '@/views/guide/ui/guideChartStyles';

// 기대값을 색 표에서 다시 읽지 않고 리터럴로 적는다 — 팔레트가 엉뚱한 표를 고르면(예: 띠 라벨이
// 선 색 토큰을 쓰면) 표에서 읽은 기대값은 같이 틀려 잡지 못한다.
const CASES: readonly (readonly [OverlayLabelColour, string])[] = [
    [{ palette: 'zone' }, 'fill-primary-300'],
    [{ palette: 'series', tone: 'a' }, 'fill-primary-300'],
    [{ palette: 'series', tone: 'b' }, 'fill-ui-warning-text'],
    [{ palette: 'series', tone: 'c' }, 'fill-secondary-200'],
    [{ palette: 'series', tone: 'bull' }, 'fill-ui-success-text'],
    [{ palette: 'series', tone: 'bear' }, 'fill-ui-danger-text'],
    [{ palette: 'role', role: 'support' }, 'fill-ui-success-text'],
    [{ palette: 'role', role: 'resistance' }, 'fill-ui-danger-text'],
    [{ palette: 'role', role: 'neckline' }, 'fill-ui-warning-text'],
    [{ palette: 'role', role: 'trend' }, 'fill-primary-300'],
    [{ palette: 'role', role: 'neutral' }, 'fill-secondary-300'],
    [{ palette: 'bar', tone: 'bull' }, 'fill-ui-success-text'],
    [{ palette: 'bar', tone: 'bear' }, 'fill-ui-danger-text'],
    [{ palette: 'bar', tone: 'neutral' }, 'fill-secondary-300'],
];

describe('overlayLabelClass', () => {
    it.each(CASES)('maps %o to the text token %s', (colour, expected) => {
        expect(overlayLabelClass(colour)).toBe(expected);
    });
});
