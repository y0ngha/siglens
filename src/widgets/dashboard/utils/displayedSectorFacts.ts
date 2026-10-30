/**
 * SSR 섹터 요약에 쓸 사실(facts)을 패널이 보여 주는 종목 기준으로 만든다.
 */
import type { SectorSignalsResult } from '@y0ngha/siglens-core';
import {
    buildSectorFacts,
    type SectorFact,
} from '@/entities/sector-signal/lib/sectorFacts';
import { listDisplayedStocks } from './sectorSignalStocks';

/** 섹터 요약 항목 한 건. UI가 entity `lib/`를 직접 import하지 않도록 여기서 이름을 붙인다. */
export type DisplayedSectorFact = SectorFact;

/** 섹터 요약의 대표 종목 한 건. */
export type DisplayedFactStock = SectorFact['topStocks'][number];

/**
 * 패널과 같은 파이프라인(`listDisplayedStocks`)을 거친 종목으로 섹터 요약을 만든다.
 * 원본 종목으로 만들면 패널이 걷어낸 종목을 요약이 세고 링크해 두 화면이 어긋난다.
 */
export function buildDisplayedSectorFacts(
    data: SectorSignalsResult
): readonly SectorFact[] {
    return buildSectorFacts({
        ...data,
        stocks: listDisplayedStocks(data.stocks),
    });
}
