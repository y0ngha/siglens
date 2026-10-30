/**
 * 브리핑의 섹터 블록 — 강세·약세 섹터 줄과 서술 문장.
 */
import { useTranslations } from 'next-intl';
import type { BriefingSector } from '../../utils/briefingSectors';
import { BriefingSectorLine } from './BriefingSectorLine';

interface BriefingSectorsProps {
    leadingSectors: readonly BriefingSector[];
    laggingSectors: readonly BriefingSector[];
    performanceDescription: string;
}

/**
 * 섹터명 줄이 전부 걸러져도 서술 문장은 남긴다 — 그 문장은 요약 데이터에서 직접 나온
 * 것이라(섹터 한국어명 + 실제 등락률) 근거가 있고 카드에서 가장 정보량이 많은 줄이다.
 * 이 조건을 섹터명 유무와 묶으면 한국 페이지가 제목·테마만 남은 빈 카드가 된다.
 */
export function BriefingSectors({
    leadingSectors,
    laggingSectors,
    performanceDescription,
}: BriefingSectorsProps) {
    const t = useTranslations('widgets.dashboard');
    const isEmpty =
        leadingSectors.length === 0 &&
        laggingSectors.length === 0 &&
        !performanceDescription;
    if (isEmpty) return null;
    return (
        <div className="flex flex-col gap-1">
            <BriefingSectorLine
                label={t('BriefingCard.e1760c')}
                sectors={leadingSectors}
                toneClass="text-ui-success-text"
            />
            <BriefingSectorLine
                label={t('BriefingCard.7bd647')}
                sectors={laggingSectors}
                toneClass="text-ui-danger-text"
            />
            {performanceDescription && (
                <p className="text-xs text-secondary-500">
                    {performanceDescription}
                </p>
            )}
        </div>
    );
}
