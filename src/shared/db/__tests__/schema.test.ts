import * as schema from '@/shared/db/schema';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contentLocaleEnum } from '@/shared/db/schema';
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { EMAIL_REPORT_CONSENT_SOURCE_VALUES } from '@/shared/db/constants';
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
        'feedback',
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

/**
 * 방문 이력 구간값 컬럼(개인정보처리방침 v15 §2) — 널 허용 `text` 다섯 개만 더하고 인덱스·기본값·
 * 백필은 없다. 구 코드는 새 컬럼을 이름에 올리지 않아 안전하지만, 새 코드는 스키마가 먼저 적용돼야 한다.
 */
describe('visitor_visit_signals 마이그레이션', () => {
    const sql = readFileSync(
        join(process.cwd(), 'drizzle/0059_visitor_visit_signals.sql'),
        'utf8'
    );

    it('visitor_days에 널 허용 text 컬럼 다섯 개만 더한다', () => {
        const statements = sql
            .split('--> statement-breakpoint')
            .map(statement => statement.trim());
        expect(statements).toEqual(
            [
                'landing_site',
                'first_visit_bucket',
                'last_visit_bucket',
                'visit_days_bucket',
                'return_window',
            ].map(
                column =>
                    `ALTER TABLE "visitor_days" ADD COLUMN "${column}" text;`
            )
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
            '0059_visitor_visit_signals'
        );
    });
});

/**
 * `landing_path`의 옛 공유 링크·대화 id를 지우는 데이터 마이그레이션(개인정보처리방침 v15 §2). 스키마는
 * 바꾸지 않는다. 실제 치환은 `visitor/__tests__/landingPathBackfill.db.test.ts`가 본다.
 */
describe('backfill_landing_path_identifiers 마이그레이션', () => {
    const sql = readFileSync(
        join(
            process.cwd(),
            'drizzle/0060_backfill_landing_path_identifiers.sql'
        ),
        'utf8'
    );

    it('visitor_days.landing_path만 고치는 UPDATE 두 개로 이루어진다', () => {
        const statements = sql
            .split('--> statement-breakpoint')
            .map(statement => statement.replace(/^--.*$/gm, '').trim());
        expect(statements).toHaveLength(2);
        for (const statement of statements) {
            expect(statement).toMatch(
                /^UPDATE "visitor_days" SET "landing_path" = regexp_replace\([\s\S]*WHERE "landing_path" ~ /
            );
            expect(statement).not.toMatch(/DELETE|DROP|ALTER|INSERT/i);
        }
    });

    it('0059 뒤에 저널에 등록돼 있다', () => {
        const journal = JSON.parse(
            readFileSync(
                join(process.cwd(), 'drizzle/meta/_journal.json'),
                'utf8'
            )
        ) as { entries: Array<{ tag: string }> };
        const tags = journal.entries.map(entry => entry.tag);
        expect(tags.indexOf('0060_backfill_landing_path_identifiers')).toBe(
            tags.indexOf('0059_visitor_visit_signals') + 1
        );
    });
});

/**
 * 신호 첫 포착 가격과 분석 생성 tier — 널 허용 컬럼 둘만 더하고 기본값·인덱스·백필은 없다. 새 코드는
 * 컬럼을 이름에 올려 INSERT하므로 스키마가 앱 배포보다 먼저 적용돼야 한다.
 */
describe('signal_price_analysis_tier 마이그레이션', () => {
    const sql = readFileSync(
        join(process.cwd(), 'drizzle/0061_signal_price_analysis_tier.sql'),
        'utf8'
    );

    it('널 허용 컬럼 둘만 더한다', () => {
        const statements = sql
            .split('--> statement-breakpoint')
            .map(statement => statement.trim());
        expect(statements).toEqual([
            'ALTER TABLE "analysis_history" ADD COLUMN "tier" varchar(16);',
            'ALTER TABLE "signal_events" ADD COLUMN "price_at_detection" double precision;',
        ]);
    });

    it('0060 뒤에 저널에 등록돼 있다', () => {
        const journal = JSON.parse(
            readFileSync(
                join(process.cwd(), 'drizzle/meta/_journal.json'),
                'utf8'
            )
        ) as { entries: Array<{ tag: string }> };
        const tags = journal.entries.map(entry => entry.tag);
        expect(tags.indexOf('0061_signal_price_analysis_tier')).toBe(
            tags.indexOf('0060_backfill_landing_path_identifiers') + 1
        );
    });

    it.each([
        ['analysis_history.tier', schema.analysisHistory.tier],
        [
            'signal_events.price_at_detection',
            schema.signalEvents.priceAtDetection,
        ],
    ])('%s 컬럼은 널 허용이고 기본값이 없다', (_label, column) => {
        expect(column.notNull).toBe(false);
        expect(column.hasDefault).toBe(false);
    });

    it('컬럼 이름이 마이그레이션과 같다', () => {
        expect(schema.analysisHistory.tier.name).toBe('tier');
        expect(schema.signalEvents.priceAtDetection.name).toBe(
            'price_at_detection'
        );
    });
});

/**
 * 메일 리포트 수신 동의 출처 컬럼과 첫 리포트 발송 기록 테이블(빈 채로 둔다) — 한 마이그레이션이 둘을 더한다.
 * 컬럼은 널 허용이라 앱 배포 전에 적용해도 옛 코드가 깨지지 않고, 백필은 설정 화면이 동의 시각을 남긴
 * 유일한 경로였다는 사실에 기댄다. 새 코드는 컬럼 이름으로 INSERT하므로 스키마가 앱 배포보다 먼저 적용돼야 한다.
 */
describe('email_report_consent_and_welcome 마이그레이션', () => {
    const sql = readFileSync(
        join(
            process.cwd(),
            'drizzle/0062_email_report_consent_and_welcome.sql'
        ),
        'utf8'
    );
    const dialect = new PgDialect();

    it('동의 출처 컬럼은 널 허용이고 기본값이 없다', () => {
        expect(schema.emailReportSubscriptions.consentSource.name).toBe(
            'consent_source'
        );
        expect(schema.emailReportSubscriptions.consentSource.notNull).toBe(
            false
        );
        expect(schema.emailReportSubscriptions.consentSource.hasDefault).toBe(
            false
        );
    });

    it('스키마의 CHECK와 마이그레이션 SQL의 CHECK가 허용 값 상수와 정확히 같은 값을 같은 순서로 적는다', () => {
        const check = getTableConfig(
            schema.emailReportSubscriptions
        ).checks.find(
            c => c.name === 'email_report_subscriptions_consent_source_check'
        );
        const literals = (text: string): string[] =>
            [
                ...(/IN \(([^)]*)\)/.exec(text)?.[1] ?? '').matchAll(
                    /'([^']+)'/g
                ),
            ].map(match => match[1] ?? '');
        const schemaCheck = dialect.sqlToQuery(check?.value as SQL).sql;
        const migrationCheck =
            sql
                .split('--> statement-breakpoint')
                .find(statement =>
                    statement.includes(
                        'email_report_subscriptions_consent_source_check'
                    )
                ) ?? '';

        expect(literals(schemaCheck)).toEqual([
            ...EMAIL_REPORT_CONSENT_SOURCE_VALUES,
        ]);
        expect(literals(migrationCheck)).toEqual([
            ...EMAIL_REPORT_CONSENT_SOURCE_VALUES,
        ]);
    });

    it('컬럼 추가는 재실행해도 안전하다(IF NOT EXISTS)', () => {
        expect(sql).toContain('ADD COLUMN IF NOT EXISTS "consent_source" text');
    });

    it('백필은 동의 시각이 있는 행만 settings로 채우고 CHECK보다 먼저 실행된다', () => {
        const backfill = `UPDATE "email_report_subscriptions" SET "consent_source" = 'settings' WHERE "consented_at" IS NOT NULL;`;
        expect(sql).toContain(backfill);
        expect(
            sql.indexOf('ADD COLUMN IF NOT EXISTS "consent_source"')
        ).toBeLessThan(sql.indexOf(backfill));
        expect(sql.indexOf(backfill)).toBeLessThan(
            sql.indexOf('ADD CONSTRAINT "email_report_subscriptions_consent')
        );
    });

    it('첫 리포트 발송 기록 테이블이 export되고 회원 삭제에 연쇄된다', () => {
        expect(schema.emailReportWelcomes).toBeDefined();
        const config = getTableConfig(schema.emailReportWelcomes);
        expect(config.name).toBe('email_report_welcomes');
        expect(config.primaryKeys).toHaveLength(0);
        expect(
            config.columns.find(column => column.name === 'user_id')?.primary
        ).toBe(true);
        expect(config.foreignKeys).toHaveLength(1);
        expect(sql).toContain('ON DELETE cascade');
    });

    it('상태 CHECK와 만든 시각 인덱스를 둔다', () => {
        const config = getTableConfig(schema.emailReportWelcomes);
        expect(config.checks.map(check => check.name)).toEqual([
            'email_report_welcomes_status_check',
        ]);
        expect(config.indexes.map(index => index.config.name)).toEqual([
            'email_report_welcomes_created_at_idx',
        ]);
    });

    it('0061 뒤에 저널에 등록돼 있다', () => {
        const journal = JSON.parse(
            readFileSync(
                join(process.cwd(), 'drizzle/meta/_journal.json'),
                'utf8'
            )
        ) as { entries: Array<{ tag: string }> };
        const tags = journal.entries.map(entry => entry.tag);
        expect(tags.indexOf('0062_email_report_consent_and_welcome')).toBe(
            tags.indexOf('0061_signal_price_analysis_tier') + 1
        );
    });
});
