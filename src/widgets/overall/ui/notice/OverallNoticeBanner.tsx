import type { OverallAnalysisNotice } from '../../types';

/** 알림 종류 → 스크린리더 역할. 쿨다운은 정상 안내(status), 실패는 즉시 알림(alert). */
const NOTICE_ROLE: Record<OverallAnalysisNotice['kind'], 'status' | 'alert'> = {
    cooldown: 'status',
    failed: 'alert',
};

interface OverallNoticeBannerProps {
    notice: OverallAnalysisNotice;
}

/**
 * 재분석이 쿨다운으로 거절되거나 실패했을 때 직전 분석 아래에 붙는 안내.
 * 결과는 그대로 두고 이유만 알린다.
 */
export function OverallNoticeBanner({ notice }: OverallNoticeBannerProps) {
    return (
        <p
            role={NOTICE_ROLE[notice.kind]}
            className="text-center text-sm text-ui-warning-text"
        >
            {notice.message}
        </p>
    );
}
