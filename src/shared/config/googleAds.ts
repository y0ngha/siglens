/**
 * Google Ads 전환 측정 설정.
 *
 * ID와 라벨은 모든 방문자의 HTML·요청에 그대로 실리는 공개 식별자라 하드코딩한다
 * (`shared/lib/cloudflareAnalytics.ts`의 beacon token과 같은 이유). Google Ads 전환
 * 액션이 주는 `send_to: 'AW-XXXX/label'`의 앞부분이 ID, 뒷부분이 라벨이다.
 * 값이 비어 있으면 태그도 전환도 전부 꺼진다.
 *
 * 운영 빌드가 아니거나 E2E 빌드면 ID가 빈 문자열이다. 개발 서버에서 한 질문·가입이
 * 광고 전환으로 잡히면 안 되고, E2E는 외부 호스트 요청을 금지한다. `E2E_TEST`는
 * NEXT_PUBLIC이 아니라 클라이언트 번들에서는 항상 undefined다 — 그래서 태그 로드
 * 여부는 서버 컴포넌트인 레이아웃이 이 값으로 판단한다. 클라이언트의
 * `trackAdsConversion`이 E2E에서 dataLayer에 쌓더라도 gtag.js가 없어 요청은 없다.
 *
 * 고지는 개인정보처리방침 v5(`db/seeds/terms/privacy/v5*.md`)가 한다. 태그가 켜진
 * 배포와 함께 `yarn db:seed:terms`로 v5를 적재해야 고지가 수집보다 늦지 않는다.
 * 계정: 383-968-0637.
 */
const ADS_ID = 'AW-18472071641';

export const GOOGLE_ADS_ID =
    process.env.NODE_ENV === 'production' && process.env.E2E_TEST !== '1'
        ? ADS_ID
        : '';

export type AdsConversion = 'signUp' | 'chatQuestion' | 'tickerSelect';

/** 전환 액션별 라벨. 빈 문자열인 전환은 보내지 않는다. */
export const GOOGLE_ADS_CONVERSION_LABELS: Readonly<
    Record<AdsConversion, string>
> = {
    signUp: 'xhaYCKS51YMdENnjlehE', // SIGLENS 가입 완료
    chatQuestion: 'BfQDCKe51YMdENnjlehE', // SIGLENS AI 질문 전송
    tickerSelect: 'CXgZCKq51YMdENnjlehE', // SIGLENS 종목 선택
};

/**
 * 가입 플래그 쿠키 도메인. ai.siglens.io에서 시작한 가입은 메인 호스트에서 끝나고
 * 핸드오프를 거쳐 ai 페이지로 돌아가므로, 상위 도메인에 둬야 ai 쪽이 읽는다.
 * 태그가 운영 빌드에서만 켜지므로 운영 도메인만 적는다(개발 환경에서는 브라우저가
 * 이 쿠키를 거부하지만 거기선 측정도 꺼져 있다).
 */
export const SIGNUP_CONVERSION_COOKIE_DOMAIN = 'siglens.io';
export const SIGNUP_CONVERSION_COOKIE_MAX_AGE_SECONDS = 600;
