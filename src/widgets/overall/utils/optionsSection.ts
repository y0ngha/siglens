import type { OverallAnalysisResponse } from '@y0ngha/siglens-core';
import type { AssetClass } from '@/shared/config/marketProfile/types';

/**
 * 옵션 분석 섹션을 그릴 수 있는 종목인지. 옵션 탭이 없는 한국 개별주식은 assetClass가
 * 'equity'여도 결과가 없는 빈 섹션만 남으므로 `hasOptions`까지 함께 본다.
 * `OverallView`의 섹션 노출과 재분석 버튼 강조가 같은 판정을 쓴다.
 */
export function hasOptionsSection(
    assetClass: AssetClass,
    hasOptions: boolean
): boolean {
    return assetClass === 'equity' && hasOptions;
}

/**
 * 재분석 버튼을 강조할지. 옵션 섹션이 실제로 보이고, 옵션 분석이 수행됐고(bullet
 * 존재), OI 스냅샷이 stale일 때만 참이다. 빈 옵션 분석에서는 stale 여부가 의미가
 * 없고, 섹션이 없는 종목에서는 강조할 근거 자체가 화면에 없다.
 */
export function shouldHighlightReanalyze(
    result: OverallAnalysisResponse,
    assetClass: AssetClass,
    hasOptions: boolean
): boolean {
    return (
        hasOptionsSection(assetClass, hasOptions) &&
        result.optionsBulletsKo.length > 0 &&
        (result.optionsOiStale ?? false)
    );
}
