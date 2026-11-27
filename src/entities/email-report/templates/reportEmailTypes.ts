import type { Locale } from '@/shared/i18n/locales';
import type {
    ReportChartDrawings,
    SymbolBrief,
    SymbolReport,
} from '../reportModel';

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
    /** 차트 이미지에 그려지는 분석 작도. 없으면(그려진 게 없으면) 이미지는 캔들·이동평균뿐이다. */
    drawings?: ReportChartDrawings | null;
    pageUrl: string;
}

/**
 * 스킬 이름(패턴·전략 카드) → 수신자 로케일의 표시명. 사전에 없는 이름은 원문 그대로 돌려준다
 * (`shared.skillName`, 사이트의 `useSkillLabel`과 같은 규칙).
 */
export type SkillLabelResolver = (name: string) => string;

/** "그 외 관심종목" 표 한 행. */
export interface SymbolBriefRow {
    brief: SymbolBrief;
    pageUrl: string;
}

/**
 * 첫 리포트 맨 위 안내 블록의 재료. 광고성 문구 없이 동의 결과와 일정만 담는다. 시간대는 따로 받지
 * 않는다 — 메일 한 통이 한 달력을 쓰도록 `BuildReportEmailInput.timeZone`을 쓴다.
 */
export interface ReportEmailWelcome {
    consentedAt: Date;
    /** 수신 요일 비트마스크(`email_report_subscriptions.days_of_week`). */
    daysOfWeek: number;
    sendHour: number;
    /** 보낼 종목이 없을 때 안내하는 샘플 메일 주소. */
    sampleUrl: string;
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
    /**
     * 보유·관심종목이 없는 회원에게 보내는 시장 신호 브리핑이면 채운다. 이때 `sections`는 비고 `briefRows`가
     * 그날 신호가 잡힌 대표 종목이다 — 제목·인사말·표 제목이 브리핑용으로 바뀌고 시장 페이지 링크가 붙는다.
     */
    marketBriefing?: { readonly marketUrl: string };
    /**
     * 가입 때 메일 리포트를 고른 회원의 첫 리포트면 채운다. 제목과 머리글이 바뀌고 맨 위에 동의 시각·일정
     * 안내가 붙는다. 보낼 종목이 없으면(`sections`와 `briefRows`가 모두 빔) 샘플 메일 링크가 대신 실린다.
     */
    welcome?: ReportEmailWelcome;
    /** 수신자의 IANA 타임존 — 분석 날짜를 수신자 달력으로 적는다. */
    timeZone: string;
    t: ReportEmailTranslator;
    signalLabel: SignalLabelResolver;
    skillLabel: SkillLabelResolver;
}
