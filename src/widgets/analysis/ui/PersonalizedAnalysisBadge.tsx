'use client';

/**
 * "내 평단 기준으로 분석했어요" 투명성 배지. 호출부는 서버-authoritative `isPersonalized`
 * (이번 제출이 실제로 포지션 버킷 캐시 키를 썼는가)가 참이고 폴백 응답이 아닐 때만
 * 렌더한다 — 홀딩 존재 여부로 게이트하면 tier hydration 전이나 버킷 해석 실패 시
 * 개인화되지 않은 결과에 배지가 붙는다. 색만으로 의미를 전하지 않도록 문구를 담는다.
 */
import { useTranslations } from 'next-intl';

export function PersonalizedAnalysisBadge() {
    const t = useTranslations('widgets.analysis');
    return (
        <span
            data-testid="personalized-analysis-badge"
            className="inline-flex items-center gap-1 rounded border-primary-400/40 bg-primary-400/10 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-primary-300"
        >
            {t('AnalysisPanel.2c520f')}
        </span>
    );
}
