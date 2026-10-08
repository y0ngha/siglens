/** `Date#getDay()` 값 — 0=일요일 … 6=토요일. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type EmailReportActionErrorCode =
    | 'unauthenticated'
    | 'invalid_days'
    | 'invalid_hour'
    | 'invalid_timezone'
    | 'invalid_input'
    | 'storage_unavailable';

/** 설정 화면이 읽고 쓰는 수신 설정. */
export interface EmailReportSettingsView {
    enabled: boolean;
    /** 오름차순·중복 없음. */
    daysOfWeek: Weekday[];
    sendHour: number;
    timezone: string;
    /**
     * 저장된 행이 있는지. 없으면 위 값들은 기본값이고, 화면은 타임존을 브라우저
     * 값으로 바꿔 보여 준다 — 처음 켜는 회원에게 서울 시각을 강요하지 않기 위함이다.
     */
    isSaved: boolean;
}

/** 클라이언트가 보내는 저장 입력. Server Action 경계에서 모양부터 다시 검증한다. */
export interface RawEmailReportSettingsInput {
    enabled: boolean;
    daysOfWeek: number[];
    sendHour: number;
    timezone: string;
}

/** 실패는 코드만 돌려준다 — 문구는 번역자를 가진 서버 액션이 만든다. */
export type ValidateEmailReportSettingsResult =
    | {
          ok: true;
          enabled: boolean;
          daysOfWeek: Weekday[];
          sendHour: number;
          timezone: string;
      }
    | { ok: false; code: EmailReportActionErrorCode };

export type SaveEmailReportSettingsResult =
    | { status: 'ok'; settings: EmailReportSettingsView }
    | { status: 'error'; code: EmailReportActionErrorCode; message: string };
