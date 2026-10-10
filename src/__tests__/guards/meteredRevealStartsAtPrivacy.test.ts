import path from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseSeedFile } from '@/../db/scripts/seedTerms';
import { METERED_REVEAL_STARTS_AT } from '@/entities/analysis/server/meteredReveal';

/**
 * 하루 무료 전체 공개 미터의 시작 시각은 개인정보처리방침 v8의 시행일과 같다.
 *
 * v8이 게스트 쿠키(`siglens_guest`)와 미터의 서버 보관 항목(게스트 id·IP 해시·공개
 * 종목)을 고지한다. 미터가 시행일보다 먼저 기록을 시작하면 고지 없는 수집이 되고,
 * 늦게 시작하면 고지만 앞서 나간다. 한쪽만 바꾸면 이 테스트가 깨진다.
 */
const PRIVACY_DIR = path.resolve(process.cwd(), 'db/seeds/terms/privacy');
const METER_POLICY_VERSION = 8;

describe('METERED_REVEAL_STARTS_AT ↔ privacy v8 effectiveDate', () => {
    it('방침 v8 원문의 시행일과 같은 시각이다', () => {
        const file = path.join(PRIVACY_DIR, `v${METER_POLICY_VERSION}.md`);
        const seed = parseSeedFile(file);
        expect(seed.kind).toBe('privacy');
        expect(seed.version).toBe(METER_POLICY_VERSION);
        expect(seed.effectiveDate?.toISOString()).toBe(
            METERED_REVEAL_STARTS_AT.toISOString()
        );
    });

    it('v8 원문이 게스트 쿠키와 하루 무료 공개 기록을 고지한다', () => {
        const body = readFileSync(
            path.join(PRIVACY_DIR, `v${METER_POLICY_VERSION}.md`),
            'utf8'
        );
        expect(body).toContain('siglens_guest');
        expect(body).toContain('하루 무료 전체 공개 기록');
    });
});
