'use client';

import { useEmailReportNudge } from '../hooks/useEmailReportNudge';
import { EmailReportNudgeModal } from './EmailReportNudgeModal';

/**
 * 회원 메일 리포트 넛지의 단일 호스트. 루트 레이아웃에 한 번만 마운트한다 — 설정 권유는
 * 어느 페이지에서든 뜰 수 있어야 하고, 종목 담기 권유는 차트 탭이 보내는 신호
 * (`symbolAnalyzedSignal`)를 받아 판정한다.
 */
export function EmailReportNudgeHost() {
    const { nudge, close } = useEmailReportNudge();
    if (nudge === null) return null;
    return <EmailReportNudgeModal nudge={nudge} onClose={close} />;
}
