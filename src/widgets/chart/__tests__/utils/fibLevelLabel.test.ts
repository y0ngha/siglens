import { describe, expect, it } from 'vitest';
import { parseFibLevelLabel } from '../../utils/fibLevelLabel';

describe('parseFibLevelLabel', () => {
    it.each([
        ['23.6%', 'retracement', '23.6%'],
        ['50%', 'retracement', '50%'],
        ['78.6%', 'retracement', '78.6%'],
        ['ext 127.2%', 'extension', '127.2%'],
        ['ABC 161.8%', 'abcExtension', '161.8%'],
        // core 2.2.1 이하 캐시 분석 — `ext ` 접두사 없이 확장이 온다.
        ['100%', 'extension', '100%'],
        ['161.8%', 'extension', '161.8%'],
    ])('%s → %s', (label, kind, percent) => {
        expect(parseFibLevelLabel(label)).toEqual({ kind, percent });
    });

    it.each(['breakout', '', 'ext', '61.8'])(
        '피보나치 라벨이 아니면 null: %j',
        label => {
            expect(parseFibLevelLabel(label)).toBeNull();
        }
    );
});
