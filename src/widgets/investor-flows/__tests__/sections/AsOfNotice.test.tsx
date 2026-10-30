// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AsOfNotice } from '../../sections/AsOfNotice';
import { KrAsOfNotice } from '../../sections/KrAsOfNotice';
import {
    evaluate,
    makeKrSnapshot,
    makeSnapshot,
} from '../fixtures/flowsFixtures';

const NOT_COLLECTING = {
    institutional: false,
    short: false,
    failsToDeliver: false,
    proposedSales: false,
    offerings: false,
    thresholdList: false,
};

function renderUs(snapshotAsOf: string) {
    render(
        <AsOfNotice
            freshness={evaluate(makeSnapshot()).freshness}
            snapshotAsOf={snapshotAsOf}
            showFinra={false}
            regShoEnabled={false}
            thresholdAsOf={null}
            collecting={NOT_COLLECTING}
        />
    );
}

function snapshotRow() {
    return screen.getByText('조회 기준일').nextElementSibling as HTMLElement;
}

describe('AsOfNotice 조회 기준일', () => {
    it('미국 저녁 스냅샷은 UTC 날짜가 아니라 미국 장 현지 날짜로 보인다', () => {
        renderUs('2026-10-17T01:00:00.000Z');
        expect(snapshotRow()).toHaveTextContent('2026-10-16');
    });
});

describe('KrAsOfNotice 조회 기준일', () => {
    it('한국 스냅샷은 서울 날짜로 보인다', () => {
        render(
            <KrAsOfNotice
                freshness={evaluate(makeKrSnapshot()).freshness}
                snapshotAsOf="2026-10-16T16:00:00.000Z"
                collecting={false}
                commonShareCorpName={null}
            />
        );
        expect(snapshotRow()).toHaveTextContent('2026-10-17');
    });
});
