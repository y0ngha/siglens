import { describe, expect, it } from 'vitest';
import {
    buildKrCollectingView,
    KR_SCORECARD_AXES,
} from '../../utils/krDisclosures';
import { makeKrSnapshot, makeSnapshot } from '../fixtures/flowsFixtures';
import type { InvestorFlowsPipelineReadiness } from '@/entities/investor-flows/model';

const READINESS: InvestorFlowsPipelineReadiness = {
    institutional: 'ready',
    short: 'ready',
    failsToDeliver: 'ready',
    filings: 'ready',
    thresholdList: 'ready',
    dart: 'ready',
};

describe('buildKrCollectingView', () => {
    it('공시가 있으면 수집 중이 아니고 수집 중으로 말할 축도 없다', () => {
        expect(buildKrCollectingView(READINESS, makeKrSnapshot())).toEqual({
            collecting: false,
            collectingAxes: [],
        });
    });

    it('DART가 수집 중이고 공시가 비었으면 점수표의 두 축을 수집 중으로 말한다', () => {
        const empty = makeSnapshot();
        expect(
            buildKrCollectingView({ ...READINESS, dart: 'collecting' }, empty)
        ).toEqual({ collecting: true, collectingAxes: KR_SCORECARD_AXES });
    });

    it('한국은 13F 수집 중에 영향받지 않는다', () => {
        const empty = makeSnapshot();
        expect(
            buildKrCollectingView(
                { ...READINESS, institutional: 'collecting' },
                empty
            ).collecting
        ).toBe(false);
    });
});
