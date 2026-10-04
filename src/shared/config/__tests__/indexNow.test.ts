import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    INDEXNOW_ENDPOINTS,
    INDEXNOW_KEY,
    INDEXNOW_KEY_LOCATION,
    INDEXNOW_MAX_URLS_PER_REQUEST,
    INDEXNOW_TIMEOUT_MS,
} from '../indexNow';

describe('indexNow config', () => {
    it('public/{key}.txt 내용이 INDEXNOW_KEY와 일치한다 — 둘이 어긋나면 검색엔진이 소유 확인에 실패한다', () => {
        const file = path.resolve(
            __dirname,
            '../../../../public',
            `${INDEXNOW_KEY}.txt`
        );

        expect(readFileSync(file, 'utf8').trim()).toBe(INDEXNOW_KEY);
    });

    it('keyLocation은 운영 호스트 루트의 {key}.txt다', () => {
        expect(INDEXNOW_KEY_LOCATION).toBe(
            `https://siglens.io/${INDEXNOW_KEY}.txt`
        );
    });

    it('IndexNow 키 형식(8~128자의 영숫자·대시)을 지킨다', () => {
        expect(INDEXNOW_KEY).toMatch(/^[a-zA-Z0-9-]{8,128}$/);
    });

    it('제출 대상은 공용 IndexNow 엔드포인트 한 곳뿐이다 — 참여 엔진끼리 공유하므로 네이버에 또 보내면 중복이다', () => {
        expect(INDEXNOW_ENDPOINTS).toEqual([
            'https://api.indexnow.org/indexnow',
        ]);
    });

    it('타임아웃과 요청당 URL 상한은 설계 값이다', () => {
        expect(INDEXNOW_TIMEOUT_MS).toBe(5_000);
        expect(INDEXNOW_MAX_URLS_PER_REQUEST).toBe(10_000);
    });
});
