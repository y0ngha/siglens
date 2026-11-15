import { existsSync } from 'node:fs';
import path from 'node:path';
import {
    findSignalHub,
    isSignalHubIndexable,
    SIGNAL_HUB_MIN_INDEXABLE_ROWS,
    SIGNAL_HUBS,
    signalHubPath,
} from '../signalHubs';

const GUIDE_SEEDS = path.resolve(__dirname, '../../../../../db/seeds/guide');

describe('SIGNAL_HUBS', () => {
    it('slug와 신호 종류가 겹치지 않는다', () => {
        expect(new Set(SIGNAL_HUBS.map(hub => hub.slug)).size).toBe(
            SIGNAL_HUBS.length
        );
        expect(new Set(SIGNAL_HUBS.map(hub => hub.signalType)).size).toBe(
            SIGNAL_HUBS.length
        );
    });

    it('slug는 URL에 그대로 쓸 수 있는 소문자 kebab-case다', () => {
        for (const hub of SIGNAL_HUBS) {
            expect(hub.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        }
    });

    it('빌려 오는 가이드 항목이 시드에 실제로 있다 — 없으면 설명 카드가 조용히 빠진다', () => {
        for (const hub of SIGNAL_HUBS) {
            expect(
                existsSync(
                    path.join(
                        GUIDE_SEEDS,
                        hub.guide.category,
                        hub.guide.slug,
                        'ko.md'
                    )
                )
            ).toBe(true);
        }
    });
});

describe('findSignalHub', () => {
    it('알려진 slug면 그 허브, 아니면 null', () => {
        expect(findSignalHub('golden-cross')?.signalType).toBe('golden_cross');
        expect(findSignalHub('golden_cross')).toBeNull();
        expect(findSignalHub('nope')).toBeNull();
    });
});

describe('signalHubPath', () => {
    it('/market/signals/<slug>', () => {
        expect(signalHubPath('52-week-high')).toBe(
            '/market/signals/52-week-high'
        );
    });
});

describe('isSignalHubIndexable', () => {
    it(`${SIGNAL_HUB_MIN_INDEXABLE_ROWS}행부터 색인한다`, () => {
        expect(isSignalHubIndexable(SIGNAL_HUB_MIN_INDEXABLE_ROWS - 1)).toBe(
            false
        );
        expect(isSignalHubIndexable(SIGNAL_HUB_MIN_INDEXABLE_ROWS)).toBe(true);
    });
});
