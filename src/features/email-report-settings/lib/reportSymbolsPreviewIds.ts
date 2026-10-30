/**
 * @file 리포트 대상 미리보기의 DOM id — 서버 컴포넌트(미리보기·페이지)와 클라이언트 훅이 함께 쓴다.
 */

/**
 * 미리보기 컨테이너의 DOM id. 칩을 누르면 그 칩(과 버튼)이 새로고침 뒤 사라지므로 포커스가
 * `body`로 떨어진다 — 토글 훅이 성공 후 이 컨테이너로 포커스를 옮겨 키보드·스크린리더 사용자가
 * 제자리를 잃지 않게 한다. 서버 컴포넌트(미리보기)와 클라이언트 훅이 함께 쓰므로 `'use client'`
 * 파일이 아닌 이 모듈에 둔다.
 */
export const REPORT_SYMBOLS_PREVIEW_ID = 'email-report-symbols-preview';

/** 미리보기를 감싼 섹션 제목의 id — 컨테이너가 `aria-labelledby`로 가리킨다. */
export const REPORT_SYMBOLS_HEADING_ID = 'email-report-symbols-heading';
