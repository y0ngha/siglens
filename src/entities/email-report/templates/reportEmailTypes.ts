import type { Locale } from '@/shared/i18n/locales';
import type { SymbolBrief, SymbolReport } from '../reportModel';

/**
 * `entities.email-report.email` 네임스페이스 번역자. 템플릿은 순수 함수라 요청 스코프가
 * 없다 — 발송 cron이 회원 로케일로 `getTranslations({ locale, namespace })`를 만들어 넘긴다.
 */
export type ReportEmailTranslator = (
    key: string,
    values?: Record<string, string>
) => string;

/**
 * 신호 타입 → 사람이 읽는 라벨. 대시보드 `SignalBadge`가 쓰는 `shared.enumLabel.signalType`
 * 사전을 메일 번역자에게도 노출한 것. core가 새 `SignalType`을 추가해 사전에 없으면 `null` —
 * 템플릿은 그 타입을 **표시에서 생략**한다(심볼 키를 그대로 내보내지 않는다). 로그는
 * 리졸버를 만든 쪽(`createSignalLabelResolver`)이 남긴다(템플릿은 순수).
 */
export type SignalLabelResolver = (type: string) => string | null;

/** 메일에 싣는 종목 한 칸 — 데이터와 그 칸의 링크. */
export interface ReportEmailSection {
    report: SymbolReport;
    /** 경량 경로가 준 신호 요약. 조회 실패면 `signals: null`이고 카드의 신호 줄은 생략된다. */
    brief: SymbolBrief;
    chartUrl: string;
    pageUrl: string;
}

/** "그 외 관심종목" 표 한 행. */
export interface SymbolBriefRow {
    brief: SymbolBrief;
    pageUrl: string;
}

/** `buildReportEmail`의 입력. 발송 cron과 비회원 샘플 페이지가 같은 모양으로 넘긴다. */
export interface BuildReportEmailInput {
    to: string;
    locale: Locale;
    /** 회원 로컬 발송일(`YYYY-MM-DD`). */
    localDate: string;
    sections: readonly ReportEmailSection[];
    /** 전체 카드 뒤의 요약 표. 비면 섹션을 생략한다. */
    briefRows: readonly SymbolBriefRow[];
    unsubscribePageUrl: string;
    unsubscribeApiUrl: string;
    settingsUrl: string;
    t: ReportEmailTranslator;
    signalLabel: SignalLabelResolver;
}
