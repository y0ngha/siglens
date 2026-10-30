/**
 * 확장 시세 캡션의 ⓘ 툴팁 leaf 컴포넌트 — 등락 기준과 체결 시각을 담는다.
 */
import { InfoTooltip } from '@/shared/ui/InfoTooltip';

interface ExtendedHoursDetailTipProps {
    basisLabel: string;
    tradedAtText: string;
}

/**
 * 줄에서 뺀 기준·체결 시각을 ⓘ에 담는다 — 호버·포커스·탭 어디서든 같은 정보를 준다.
 * `shrink-0` 래퍼라 옆 글줄이 말줄임돼도 ⓘ는 잘리지 않는다.
 */
export function ExtendedHoursDetailTip({
    basisLabel,
    tradedAtText,
}: ExtendedHoursDetailTipProps) {
    return (
        <span className="shrink-0">
            <InfoTooltip>
                <span data-testid="extended-hours-detail">
                    {basisLabel} <span aria-hidden="true">|</span>{' '}
                    {tradedAtText}
                </span>
            </InfoTooltip>
        </span>
    );
}
