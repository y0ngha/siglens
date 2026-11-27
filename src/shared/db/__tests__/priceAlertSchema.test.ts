import type { SQL } from 'drizzle-orm';
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PriceAlertBasis } from '@/entities/mail-alert/model';
import {
    PRICE_ALERT_APPROACH_VALUES,
    PRICE_ALERT_BASIS_VALUES,
    PRICE_ALERT_CONDITION_VALUES,
    PRICE_ALERT_MARKET_VALUES,
    PRICE_ALERT_STATUS_VALUES,
} from '@/shared/db/constants';
import * as schema from '@/shared/db/schema';
import type { PriceAlertConditionRecord } from '@/shared/db/types';

const MIGRATION = readFileSync(
    join(process.cwd(), 'drizzle', '0065_price_alerts.sql'),
    'utf8'
);
const dialect = new PgDialect();

/** 컴파일 시점에 엔티티·저장 계층 유니온의 모든 값을 키로 강제한다 — 값이 빠지거나 늘면 타입 오류가 난다. */
const ENTITY_BASES: Record<PriceAlertBasis, true> = {
    analysis_entry_zone: true,
    analysis_invalidation: true,
    price_level: true,
};
const CONDITION_KINDS: Record<PriceAlertConditionRecord['kind'], true> = {
    enter_zone: true,
    close_below: true,
    close_above: true,
};

function literals(text: string): string[] {
    return [
        ...(/IN \(([^)]*)\)/.exec(text)?.[1] ?? '').matchAll(/'([^']+)'/g),
    ].map(match => match[1] ?? '');
}

function schemaCheck(name: string): string {
    const check = getTableConfig(schema.priceAlerts).checks.find(
        c => c.name === name
    );
    return dialect.sqlToQuery(check?.value as SQL).sql;
}

function migrationCheck(name: string): string {
    return (
        MIGRATION.split('--> statement-breakpoint')
            .flatMap(statement => statement.split('\n'))
            .find(line => line.includes(`CONSTRAINT "${name}" CHECK`)) ?? ''
    );
}

describe('가격대 알림 스키마 상수', () => {
    it('엔티티·저장 유니온과 DB 허용 값 상수가 같다', () => {
        expect(Object.keys(ENTITY_BASES)).toEqual([
            ...PRICE_ALERT_BASIS_VALUES,
        ]);
        expect(Object.keys(CONDITION_KINDS)).toEqual([
            ...PRICE_ALERT_CONDITION_VALUES,
        ]);
    });

    it.each([
        ['price_alerts_market_check', PRICE_ALERT_MARKET_VALUES],
        ['price_alerts_condition_check', PRICE_ALERT_CONDITION_VALUES],
        ['price_alerts_approach_check', PRICE_ALERT_APPROACH_VALUES],
        ['price_alerts_basis_check', PRICE_ALERT_BASIS_VALUES],
        ['price_alerts_status_check', PRICE_ALERT_STATUS_VALUES],
    ] as const)(
        '%s는 스키마와 마이그레이션 SQL 모두 상수와 같은 값을 같은 순서로 적는다',
        (name, values) => {
            expect(literals(schemaCheck(name))).toEqual([...values]);
            expect(literals(migrationCheck(name))).toEqual([...values]);
        }
    );
});

describe('가격대 알림 테이블 구조', () => {
    const config = getTableConfig(schema.priceAlerts);

    it('구독자 삭제에 연쇄된다', () => {
        expect(config.name).toBe('price_alerts');
        expect(config.foreignKeys.map(fk => fk.onDelete)).toEqual(['cascade']);
    });

    it('(구독자, 제안) 유니크 인덱스로 더블클릭을 멱등하게 만든다', () => {
        const unique = config.indexes.find(
            index =>
                index.config.name === 'price_alerts_subscriber_proposal_uidx'
        );
        expect(unique?.config.unique).toBe(true);
        expect(
            unique?.config.columns.map(column =>
                'name' in column ? column.name : ''
            )
        ).toEqual(['subscriber_id', 'proposal_id']);
    });

    it('조건별 모양 CHECK가 스키마와 마이그레이션에 같게 있다', () => {
        for (const name of [
            'price_alerts_shape_check',
            'price_alerts_reference_close_check',
            'price_alerts_finite_check',
            'price_alerts_fired_state_check',
            'price_alerts_basis_shape_check',
        ]) {
            expect(schemaCheck(name)).not.toBe('');
            expect(migrationCheck(name)).toContain(schemaCheck(name));
        }
    });

    it('(구독자, 제안) 유니크 인덱스가 구독자 조회를 덮으므로 구독자 단독 인덱스는 없다', () => {
        expect(config.indexes.map(index => index.config.name)).toEqual([
            'price_alerts_subscriber_proposal_uidx',
            'price_alerts_status_expires_idx',
        ]);
    });

    it('상태 기본값은 active다', () => {
        expect(config.columns.find(c => c.name === 'status')?.default).toBe(
            'active'
        );
    });
});

describe('0065_price_alerts 마이그레이션', () => {
    it('테이블 하나를 더하고 구독자 CHECK만 다시 만든다(데이터는 건드리지 않는다)', () => {
        expect(MIGRATION.match(/CREATE TABLE "([a-z_]+)"/g)).toEqual([
            'CREATE TABLE "price_alerts"',
        ]);
        expect(MIGRATION.match(/DROP [A-Z ]+"[a-z_]+"/g)).toEqual([
            'DROP CONSTRAINT IF EXISTS "mail_alert_subscribers_consent_source_check"',
        ]);
        expect(MIGRATION).not.toMatch(/^(UPDATE|DELETE FROM|INSERT INTO)\b/m);
    });
});
