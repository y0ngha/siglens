/**
 * 섹터 신호를 조회하는 동안의 본문 자리 표시.
 */
import { SubsectionPlaceholders } from './SubsectionPlaceholders';

/**
 * "신호 없음"이 아니라 "아직 모름"을 알린다. 스켈레톤과 같은 틀(`SubsectionPlaceholders`)로
 * 자리를 잡아 데이터가 도착해도 레이아웃이 크게 밀리지 않는다. 낭독은 패널의 상태 줄이 맡는다.
 */
export function SectorSignalLoading() {
    return (
        <div aria-busy="true">
            <SubsectionPlaceholders />
        </div>
    );
}
