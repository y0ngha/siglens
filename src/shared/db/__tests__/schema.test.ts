import * as schema from '@/shared/db/schema';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contentLocaleEnum } from '@/shared/db/schema';
import { LOCALES } from '@/shared/i18n/locales';

describe('schema 테이블 export', () => {
    const expectedTables = [
        'users',
        'sessions',
        'oauthAccounts',
        'userApiKeys',
        'koreanTickers',
        'profileDescriptionTranslations',
        'assetTranslations',
        'inquiries',
        'news',
        'earningsReports',
        'terms',
        'agreements',
        'sharedAnalyses',
        'analysisPromptBlobs',
        'analysisHistory',
        'visitorDays',
        'funnelEvents',
    ] as const;

    it.each(expectedTables)("'%s' 테이블이 export 되어 있다", tableName => {
        expect(schema[tableName]).toBeDefined();
    });

    it('각 테이블이 non-null 객체이다', () => {
        for (const tableName of expectedTables) {
            const table = schema[tableName];
            expect(typeof table).toBe('object');
            expect(table).not.toBeNull();
        }
    });
});

describe('schema enum export', () => {
    const expectedEnums = [
        'userTierEnum',
        'oauthProviderEnum',
        'llmProviderEnum',
        'termsKindEnum',
        'shareableKindEnum',
    ] as const;

    it.each(expectedEnums)("'%s' enum이 export 되어 있다", enumName => {
        expect(schema[enumName]).toBeDefined();
    });
});

describe('users 테이블 컬럼', () => {
    it('id, email, tier, createdAt, updatedAt 컬럼 속성이 존재한다', () => {
        const users = schema.users;
        expect(users.id).toBeDefined();
        expect(users.email).toBeDefined();
        expect(users.tier).toBeDefined();
        expect(users.createdAt).toBeDefined();
        expect(users.updatedAt).toBeDefined();
    });
});

describe('sessions 테이블 컬럼', () => {
    it('id, userId, expiresAt, createdAt 컬럼 속성이 존재한다', () => {
        const sessions = schema.sessions;
        expect(sessions.id).toBeDefined();
        expect(sessions.userId).toBeDefined();
        expect(sessions.expiresAt).toBeDefined();
        expect(sessions.createdAt).toBeDefined();
    });
});

describe('economicIndicatorTranslations 테이블 컬럼', () => {
    it('normalizedName, koreanName, source, updatedAt 컬럼 속성이 존재한다', () => {
        const cols = Object.keys(schema.economicIndicatorTranslations);
        expect(cols).toContain('normalizedName');
        expect(cols).toContain('koreanName');
        expect(cols).toContain('source');
        expect(cols).toContain('updatedAt');
    });
});

/**
 * DB 로케일 축이 `shared/i18n/locales.ts`와 어긋나면, 코드가 아는 로케일을
 * DB가 거부하거나 그 반대가 된다 — 둘 다 런타임에서야 드러난다.
 */
describe('content locale 축', () => {
    it('content_locale enum이 LOCALES와 정확히 같다', () => {
        expect(contentLocaleEnum.enumValues).toEqual([...LOCALES]);
    });

    it('마이그레이션 SQL도 같은 값을 만든다', () => {
        const sql = readFileSync(
            join(process.cwd(), 'drizzle/0029_content_locale.sql'),
            'utf8'
        );
        const values = LOCALES.map(locale => `'${locale}'`).join(', ');
        expect(sql).toContain(
            `CREATE TYPE "public"."content_locale" AS ENUM(${values})`
        );
    });

    /**
     * 마이그레이션이 저널에 없으면 `yarn db:migrate`가 **조용히 건너뛴다** —
     * 파일은 있는데 아무 일도 일어나지 않는 상태(이 레포가 ISR 부트스트랩에서
     * 겪은 silently-inert 결함군)를 막는다.
     */
    it('저널에 등록돼 있다 — 등록 없이는 db:migrate가 건너뛴다', () => {
        const journal = JSON.parse(
            readFileSync(
                join(process.cwd(), 'drizzle/meta/_journal.json'),
                'utf8'
            )
        ) as { entries: Array<{ tag: string }> };
        expect(journal.entries.map(entry => entry.tag)).toContain(
            '0029_content_locale'
        );
    });
});

/**
 * 가입 퍼널 테이블의 FK 의미를 SQL로 고정한다 — `visitor_days.user_id`는 탈퇴해도 방문 행
 * (익명 집계)이 남아야 하므로 SET NULL, `funnel_events.user_id`는 회원 행동 기록이라 cascade.
 * 개인정보처리방침 v7 §4("회원 식별자가 연결된 행은 즉시 삭제")가 이 두 줄에 기댄다.
 */
describe('funnel_events 마이그레이션', () => {
    const sql = readFileSync(
        join(process.cwd(), 'drizzle/0042_funnel_events.sql'),
        'utf8'
    );

    it('visitor_days.user_id는 탈퇴 시 SET NULL — 방문 행은 남고 회원 연결만 끊긴다', () => {
        expect(sql).toMatch(
            /"visitor_days_user_id_users_id_fk"[^;]*ON DELETE set null/
        );
    });

    it('funnel_events.user_id는 탈퇴 시 cascade', () => {
        expect(sql).toMatch(
            /"funnel_events_user_id_users_id_fk"[^;]*ON DELETE cascade/
        );
    });

    it('이벤트·회원 축 인덱스와 visitor_days 회원 인덱스를 만든다', () => {
        expect(sql).toContain(
            'CREATE INDEX "funnel_events_event_time_idx" ON "funnel_events" USING btree ("event","occurred_at")'
        );
        expect(sql).toContain(
            'CREATE INDEX "funnel_events_user_time_idx" ON "funnel_events" USING btree ("user_id","occurred_at")'
        );
        expect(sql).toContain(
            'CREATE INDEX "visitor_days_user_id_idx" ON "visitor_days" USING btree ("user_id","date")'
        );
    });

    it('저널에 등록돼 있다 — 등록 없이는 db:migrate가 건너뛴다', () => {
        const journal = JSON.parse(
            readFileSync(
                join(process.cwd(), 'drizzle/meta/_journal.json'),
                'utf8'
            )
        ) as { entries: Array<{ tag: string }> };
        expect(journal.entries.map(entry => entry.tag)).toContain(
            '0042_funnel_events'
        );
    });
});
