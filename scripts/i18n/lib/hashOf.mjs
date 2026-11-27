import { createHash } from 'node:crypto';

/**
 * `messages/_meta/hashes.json`에 저장하는 ko 값의 콘텐츠 해시.
 *
 * `translate.mjs`(변경분 판정·기록)와 `verify.mjs`(오래된 해시 검출)가 같은
 * 함수를 써야 한다 — 따로 구현하면 두 쪽의 정의가 어긋나는 순간 검증이
 * 거짓 양성·음성을 낸다. 호출자는 `String(value)`를 넘긴다(배열 값은
 * `JSON.stringify`가 아니라 `String`으로 쉼표 결합된다).
 */
export const hashOf = text =>
    createHash('sha1').update(text).digest('hex').slice(0, 12);
