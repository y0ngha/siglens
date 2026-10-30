/**
 * 브리핑 생성 시각 줄 — 시간대 이름을 함께 적는다.
 */
import { useTranslations } from 'next-intl';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import {
    formatBriefingTime,
    parseGeneratedAt,
} from '../../utils/briefingTimestamp';

interface BriefingTimestampProps {
    /** ISO 시각. 서버 seed 단계에는 빈 문자열이다. */
    generatedAt: string;
}

/**
 * 생성 시각이 없으면(peek seed) 줄을 숨기되 **자리는 남긴다** — 비워 두면 응답이
 * 도착해 줄이 생기는 순간 아래 섹터 신호 패널이 한 줄만큼 밀린다(CLS).
 *
 * 시간대는 한국으로 고정하고(SSR/CSR 불일치 방지) 로케일은 현재 로케일을 따른다. "KST"는
 * 문장 안에 고정 표기로 두고 `<time>`에는 날짜·시각만 담는다 — ICU 짧은 시간대 이름은
 * 런타임마다 달라 서버와 브라우저의 출력이 갈릴 수 있다. 문장 전체를 한 키로 번역해 어순을
 * 로케일이 정한다.
 */
export function BriefingTimestamp({ generatedAt }: BriefingTimestampProps) {
    const t = useTranslations('widgets.dashboard');
    const locale = useResolvedLocale();
    const date = parseGeneratedAt(generatedAt);

    if (date === null) {
        return (
            <p aria-hidden="true" className="invisible text-xs">
                &nbsp;
            </p>
        );
    }
    return (
        <p className="text-xs text-secondary-500">
            {t.rich('BriefingCard.generatedAt', {
                v0: formatBriefingTime(date, locale),
                time: chunks => (
                    <time dateTime={date.toISOString()}>{chunks}</time>
                ),
            })}
        </p>
    );
}
