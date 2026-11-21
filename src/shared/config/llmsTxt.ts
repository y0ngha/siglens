/**
 * llms.txt 경로. `next.config.ts`의 rewrite(`/llms.txt` → `/api/llms`)와 두 호스트 파일이 서로를 가리키는 링크가
 * 같은 값을 본다. rewrite 쪽은 RSS와 같이 리터럴이고 테스트가 이 상수와 대조한다.
 */
export const LLMS_TXT_PATH = '/llms.txt';
