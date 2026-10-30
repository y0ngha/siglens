/**
 * `/email-report` 설정 페이지의 앱 경로(로케일 접두사 없음). 메타데이터의 canonical·og:url과 회원
 * 가드의 로그인 후 돌아올 경로가 같은 값을 써야 하므로 한 곳에 둔다 — `page.tsx`는 Next 규약 밖의
 * 값을 export할 수 없어 여기 둔다.
 */
export const EMAIL_REPORT_PATH = '/email-report';
