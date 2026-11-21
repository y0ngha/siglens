import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SQL } from 'drizzle-orm';
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import type {
    MailAlertConsentSource,
    MailAlertTopic,
} from '@/entities/mail-alert/model';
import {
    MAIL_ALERT_CONSENT_SOURCE_VALUES,
    MAIL_ALERT_DELIVERY_STATUS_VALUES,
    MAIL_ALERT_TOPIC_KIND_VALUES,
} from '@/shared/db/constants';
import * as schema from '@/shared/db/schema';
import type { MailAlertDeliveryOutcome } from '@/shared/db/types';

const MIGRATION = readFileSync(
    join(process.cwd(), 'drizzle', '0063_mail_alerts.sql'),
    'utf8'
);
const dialect = new PgDialect();

/** 컴파일 시점에 엔티티 유니온의 모든 값을 키로 강제한다 — 값이 빠지거나 늘면 타입 오류가 난다. */
const ENTITY_CONSENT_SOURCES: Record<MailAlertConsentSource, true> = {
    symbol: true,
    fear_greed: true,
    signal_hub: true,
    settings: true,
};
const ENTITY_TOPIC_KINDS: Record<MailAlertTopic['kind'], true> = {
    symbol: true,
    signal: true,
    fear_greed: true,
};
const ENTITY_DELIVERY_OUTCOMES: Record<MailAlertDeliveryOutcome, true> = {
    sent: true,
    failed: true,
};

function literals(text: string): string[] {
    return [
        ...(/IN \(([^)]*)\)/.exec(text)?.[1] ?? '').matchAll(/'([^']+)'/g),
    ].map(match => match[1] ?? '');
}

function schemaCheckLiterals(
    table: Parameters<typeof getTableConfig>[0],
    name: string
): string[] {
    const check = getTableConfig(table).checks.find(c => c.name === name);
    return literals(dialect.sqlToQuery(check?.value as SQL).sql);
}

function migrationCheckLiterals(name: string): string[] {
    return literals(
        MIGRATION.split('--> statement-breakpoint').find(statement =>
            statement.includes(`"${name}" CHECK`)
        ) ?? ''
    );
}

describe('알림 메일 스키마 상수', () => {
    it('엔티티 유니온과 DB 허용 값 상수가 같다', () => {
        expect(Object.keys(ENTITY_CONSENT_SOURCES)).toEqual([
            ...MAIL_ALERT_CONSENT_SOURCE_VALUES,
        ]);
        expect(Object.keys(ENTITY_TOPIC_KINDS)).toEqual([
            ...MAIL_ALERT_TOPIC_KIND_VALUES,
        ]);
        expect(
            Object.keys(ENTITY_DELIVERY_OUTCOMES).every(outcome =>
                (
                    MAIL_ALERT_DELIVERY_STATUS_VALUES as readonly string[]
                ).includes(outcome)
            )
        ).toBe(true);
        expect([...MAIL_ALERT_DELIVERY_STATUS_VALUES]).toEqual([
            'pending',
            'sent',
            'failed',
        ]);
    });

    it.each([
        [
            'mail_alert_subscribers_consent_source_check',
            () => schema.mailAlertSubscribers,
            MAIL_ALERT_CONSENT_SOURCE_VALUES,
        ],
        [
            'mail_alert_topics_kind_check',
            () => schema.mailAlertTopics,
            MAIL_ALERT_TOPIC_KIND_VALUES,
        ],
        [
            'mail_alert_deliveries_status_check',
            () => schema.mailAlertDeliveries,
            MAIL_ALERT_DELIVERY_STATUS_VALUES,
        ],
    ] as const)(
        '%s는 스키마와 마이그레이션 SQL 모두 상수와 같은 값을 같은 순서로 적는다',
        (name, table, values) => {
            expect(schemaCheckLiterals(table(), name)).toEqual([...values]);
            expect(migrationCheckLiterals(name)).toEqual([...values]);
        }
    );
});

describe('알림 메일 테이블 구조', () => {
    it('구독자는 주소와 회원 id가 각각 유니크이고 회원 삭제에 연쇄된다', () => {
        const config = getTableConfig(schema.mailAlertSubscribers);
        expect(config.name).toBe('mail_alert_subscribers');
        expect(config.columns.find(c => c.name === 'email')?.isUnique).toBe(
            true
        );
        const userId = config.columns.find(c => c.name === 'user_id');
        expect(userId?.isUnique).toBe(true);
        expect(userId?.notNull).toBe(false);
        expect(config.foreignKeys.map(fk => fk.onDelete)).toEqual(['cascade']);
        expect(
            config.columns.find(c => c.name === 'include_portfolio')?.default
        ).toBe(false);
    });

    it('항목은 (구독자, 종류, 키)가 기본키이고 구독자 삭제에 연쇄된다', () => {
        const config = getTableConfig(schema.mailAlertTopics);
        expect(config.name).toBe('mail_alert_topics');
        expect(
            config.primaryKeys[0]?.columns.map(column => column.name)
        ).toEqual(['subscriber_id', 'kind', 'key']);
        expect(config.foreignKeys.map(fk => fk.onDelete)).toEqual(['cascade']);
    });

    it('발송 기록은 (구독자, 알림 날짜) 유니크 인덱스로 하루 한 통을 지키고 구독자 삭제에 연쇄된다', () => {
        const config = getTableConfig(schema.mailAlertDeliveries);
        expect(config.name).toBe('mail_alert_deliveries');
        const unique = config.indexes.find(
            index =>
                index.config.name ===
                'mail_alert_deliveries_subscriber_date_uidx'
        );
        expect(unique?.config.unique).toBe(true);
        expect(
            unique?.config.columns.map(column =>
                'name' in column ? column.name : ''
            )
        ).toEqual(['subscriber_id', 'alert_date']);
        expect(config.foreignKeys.map(fk => fk.onDelete)).toEqual(['cascade']);
    });
});

describe('0063_mail_alerts 마이그레이션', () => {
    it('세 테이블을 추가만 하고 기존 테이블을 바꾸거나 지우지 않는다', () => {
        expect(MIGRATION.match(/CREATE TABLE "([a-z_]+)"/g)).toEqual([
            'CREATE TABLE "mail_alert_deliveries"',
            'CREATE TABLE "mail_alert_subscribers"',
            'CREATE TABLE "mail_alert_topics"',
        ]);
        expect(MIGRATION).not.toMatch(/\bDROP\b/);
        expect(MIGRATION).not.toMatch(/ALTER TABLE "(?!mail_alert_)/);
        expect(MIGRATION).not.toMatch(/^(UPDATE|DELETE FROM|INSERT INTO)\b/m);
    });
});
