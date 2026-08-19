import { SITE_NAME } from '@/shared/lib/seo';

export const INVESTMENT_DISCLAIMER =
    '본 서비스의 분석 정보는 투자 참고용이며, 투자 결정의 책임은 이용자에게 있습니다.';

export const PRIVACY_PATH = '/privacy';
export const TERMS_PATH = '/terms';

export const PRIVACY_TITLE = '개인정보처리방침';
export const PRIVACY_FULL_TITLE = `${PRIVACY_TITLE} | ${SITE_NAME}`;
export const PRIVACY_DESCRIPTION = `${SITE_NAME} 개인정보처리방침을 안내합니다. 회원가입과 서비스 이용 과정에서 수집하는 개인정보의 항목과 이용 목적, 보관 및 파기 기간, 제3자 제공 여부는 물론, 이용자가 직접 행사할 수 있는 열람·정정·삭제 등의 권리까지 한 페이지에서 자세히 확인하세요.`;

export const TERMS_TITLE = '이용약관';
export const TERMS_FULL_TITLE = `${TERMS_TITLE} | ${SITE_NAME}`;
export const TERMS_DESCRIPTION = `${SITE_NAME} 서비스 이용약관을 안내합니다. 회원가입 및 서비스 이용 조건, AI 분석·백테스팅 등 투자 정보 제공에 대한 면책 조항, 계정 관리와 콘텐츠 이용 규칙, 그리고 이용자와 회사가 각각 지켜야 할 권리와 의무까지 한 페이지에서 자세히 확인하세요.`;

const KST_LONG_DATE_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
});

export function formatKoreanDate(date: Date): string {
    return KST_LONG_DATE_FORMATTER.format(date);
}
