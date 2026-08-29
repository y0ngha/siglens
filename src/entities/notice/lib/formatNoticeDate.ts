/**
 * createdAt에서 표시용 연·월·일을 뽑는다(로컬 타임존). 파싱 실패 시 `null`.
 *
 * 문장 조립을 여기서 하지 않는 이유: 이 모듈은 `NoticePopup`을 통해 클라이언트
 * 번들에 들어가는데, 번역자를 인자로 받으면서 그 안에서 `t('리터럴')`을 부르면
 * 추출기가 파일을 통째로 건너뛰어 그 키가 클라이언트 페이로드에서 빠진다
 * (§noTranslatorParamCall.test.ts). 조립은 번역자를 선언한 컴포넌트가 한다.
 */
export interface NoticeDateParts {
    year: string;
    month: string;
    day: string;
}

export function formatNoticeDate(
    dateInput: Date | string
): NoticeDateParts | null {
    const date =
        typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (Number.isNaN(date.getTime())) return null;
    return {
        year: String(date.getFullYear()),
        month: String(date.getMonth() + 1).padStart(2, '0'),
        day: String(date.getDate()).padStart(2, '0'),
    };
}
