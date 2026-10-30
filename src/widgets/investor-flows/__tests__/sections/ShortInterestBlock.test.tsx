// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShortInterestBlock } from '../../sections/ShortInterestBlock';
import { buildShortInterestView } from '../../utils/short';
import {
    evaluate,
    makeShortInterest,
    makeSnapshot,
} from '../fixtures/flowsFixtures';

describe('ShortInterestBlock 추이 그래프', () => {
    it('두 그래프 모두 양 끝 라벨이 MM-DD 형식이다', () => {
        const snapshot = makeSnapshot({ shortInterest: makeShortInterest(4) });
        const { rows, previousChange } = buildShortInterestView(
            snapshot.shortInterest ?? [],
            snapshot.floatShares
        );
        render(
            <ShortInterestBlock
                rows={rows}
                metrics={evaluate(snapshot).short.metrics}
                previousChange={previousChange}
            />
        );
        // 잔고 그래프와 상환일수 그래프 각각 시작(06-15)·끝(09-15) 라벨이다.
        expect(screen.getAllByText('06-15')).toHaveLength(2);
        expect(screen.getAllByText('09-15')).toHaveLength(2);
        expect(screen.queryByText('2026-06-15')).toBeNull();
    });
});
