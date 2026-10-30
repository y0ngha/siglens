/**
 * 브리핑이 지목한 섹터명을 이 시장의 실제 섹터로 거르는 순수 헬퍼.
 */
import type { ClientDashboardScope } from '@/shared/config/dashboardScope';

/** 화이트리스트를 통과한 섹터. 표시 문자열은 `symbol`로 카탈로그에서 다시 찾는다. */
export interface BriefingSector {
    symbol: string;
    name: string;
}

/**
 * 브리핑이 지목한 섹터명 중 **이 시장에 실제로 존재하는 것만** 남긴다.
 *
 * 프롬프트가 섹터 행을 `한국어명 (티커)`로 싣고 "목록 밖 이름을 쓰지 말라"고 못박지만
 * 모델 출력이라 규칙 준수가 보증은 아니다. 화면 앞단에서 한 번 더 거른다.
 *
 * `leadingSectors`/`laggingSectors`는 티커가 아니라 **표시용 한국어명**이다. 심볼로
 * 비교하면 정상 출력이 전부 걸러진다.
 *
 * 허용 목록은 `sectorEtfs`뿐이다 — 모델에 준 섹터 행이 이 배열로만 만들어진다.
 * `signalSectors`를 합치면 상장 ETF가 없는 미국 가상 테마(양자·우주)가 통과해,
 * 이 가드가 막으려던 "지어낸 이름"이 새어 들어온다.
 *
 * 이름이 아니라 **심볼을 함께 돌려준다.** 이름을 그대로 내보내면 영어 페이지에서
 * 번역된 문장 옆에 한국어 섹터명이 붙는다. 번역하면 `koreanName` 기준 비교가 깨지므로
 * 표시는 심볼로 카탈로그에서 다시 찾는다.
 */
export function filterKnownSectors(
    names: readonly string[],
    scope: ClientDashboardScope
): BriefingSector[] {
    const symbolByName = new Map(
        scope.sectorEtfs.map(sector => [sector.koreanName, sector.symbol])
    );
    return names.flatMap(name => {
        const symbol = symbolByName.get(name);
        return symbol === undefined ? [] : [{ symbol, name }];
    });
}
