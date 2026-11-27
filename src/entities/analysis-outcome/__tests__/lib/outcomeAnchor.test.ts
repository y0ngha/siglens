import {
    CRYPTO_SESSION,
    US_EQUITY_SESSION,
    type MarketSessionSpec,
    type OutcomeSubject,
} from '@y0ngha/siglens-core';
import { describe, expect, it } from 'vitest';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import {
    anchorCloseBasisOf,
    buildOutcomeAnchor,
} from '../../lib/outcomeAnchor';

const SUBJECT = (anchor: OutcomeSubject['anchor']): OutcomeSubject => ({
    v: 1,
    anchor,
    trend: 'bullish',
    riskLevel: 'medium',
    plan: null,
    levels: [],
    scenarioTargets: [],
    patterns: [],
});

/** Tue 2026-11-17 daily bar (UTC midnight seconds). */
const DAILY_BAR_TIME = Date.parse('2026-11-17T00:00:00Z') / 1000;

describe('buildOutcomeAnchor', () => {
    it('no stored anchor: falls back to the generation time (degraded path)', () => {
        const generatedAt = new Date('2026-11-10T15:00:00Z');
        expect(
            buildOutcomeAnchor(
                SUBJECT(null),
                generatedAt,
                '1Day',
                US_EQUITY_SESSION
            )
        ).toEqual({ generatedAtMs: generatedAt.getTime() });
    });

    describe('1Day: closed once the session close has passed (clock rule)', () => {
        const at = (
            spec: MarketSessionSpec,
            barDate: string,
            generated: string
        ) =>
            buildOutcomeAnchor(
                SUBJECT({
                    barTime: Date.parse(`${barDate}T00:00:00Z`) / 1000,
                    close: 100,
                }),
                new Date(generated),
                '1Day',
                spec
            );

        it('US: after the close but before the EOD roll the anchor is already closed (the analysis saw a complete bar)', () => {
            // Fri 2026-11-20 closes 21:00 UTC.
            expect(
                at(US_EQUITY_SESSION, '2026-11-20', '2026-11-20T21:30:00Z')
            ).toMatchObject({ closedAtAnalysis: true });
            expect(
                at(US_EQUITY_SESSION, '2026-11-20', '2026-11-20T21:00:00Z')
            ).toMatchObject({ closedAtAnalysis: true });
        });

        it('US: one second before the close, and during the session, it is forming', () => {
            expect(
                at(US_EQUITY_SESSION, '2026-11-20', '2026-11-20T20:59:59Z')
            ).toMatchObject({ closedAtAnalysis: false });
            expect(
                at(US_EQUITY_SESSION, '2026-11-20', '2026-11-20T15:00:00Z')
            ).toMatchObject({ closedAtAnalysis: false });
        });

        it('US: the next day it is closed', () => {
            expect(
                at(US_EQUITY_SESSION, '2026-11-20', '2026-11-21T01:30:00Z')
            ).toMatchObject({ closedAtAnalysis: true });
        });

        it('KR: 06:45 UTC (after the 06:30 close) is closed; 06:00 is forming', () => {
            expect(
                at(KR_EQUITY_SESSION, '2026-11-17', '2026-11-17T06:45:00Z')
            ).toMatchObject({ closedAtAnalysis: true });
            expect(
                at(KR_EQUITY_SESSION, '2026-11-17', '2026-11-17T06:00:00Z')
            ).toMatchObject({ closedAtAnalysis: false });
        });

        it('crypto: the bar closes at the next UTC midnight', () => {
            expect(
                at(CRYPTO_SESSION, '2026-11-17', '2026-11-17T23:59:59Z')
            ).toMatchObject({ closedAtAnalysis: false });
            expect(
                at(CRYPTO_SESSION, '2026-11-17', '2026-11-18T00:00:30Z')
            ).toMatchObject({ closedAtAnalysis: true });
        });

        it('passes the stored bar and close through', () => {
            expect(
                at(US_EQUITY_SESSION, '2026-11-17', '2026-11-19T12:00:00Z')
            ).toEqual({
                barTime: DAILY_BAR_TIME,
                closeAtAnalysis: 100,
                closedAtAnalysis: true,
            });
        });
    });

    describe('anchorCloseBasisOf: where the anchor close the analysis saw came from', () => {
        const basis = (
            spec: MarketSessionSpec,
            barDate: string,
            generated: string,
            timeframe: '1Day' | '15Min' = '1Day'
        ) =>
            anchorCloseBasisOf(
                SUBJECT({
                    barTime: Date.parse(`${barDate}T00:00:00Z`) / 1000,
                    close: 100,
                }),
                new Date(generated),
                timeframe,
                spec
            );

        it('US: 21:30Z after the close, before the EOD roll, is a live quote', () => {
            expect(
                basis(US_EQUITY_SESSION, '2026-11-20', '2026-11-20T21:30:00Z')
            ).toBe('after_close_quote');
            expect(
                basis(US_EQUITY_SESSION, '2026-11-20', '2026-11-21T00:59:59Z')
            ).toBe('after_close_quote');
        });

        it('US: from the EOD roll (01:00Z) and the next day it is the published close', () => {
            expect(
                basis(US_EQUITY_SESSION, '2026-11-20', '2026-11-21T01:30:00Z')
            ).toBe('eod_published');
            expect(
                basis(US_EQUITY_SESSION, '2026-11-20', '2026-11-21T09:00:00Z')
            ).toBe('eod_published');
        });

        it('US: an older bar seen later is published', () => {
            expect(
                basis(US_EQUITY_SESSION, '2026-11-17', '2026-11-20T15:00:00Z')
            ).toBe('eod_published');
        });

        it('US: still inside the session the anchor is forming, so there is no basis', () => {
            expect(
                basis(US_EQUITY_SESSION, '2026-11-20', '2026-11-20T15:00:00Z')
            ).toBeNull();
        });

        it('KR: 06:45Z is a live quote, the afternoon after the roll is published', () => {
            expect(
                basis(KR_EQUITY_SESSION, '2026-11-17', '2026-11-17T06:45:00Z')
            ).toBe('after_close_quote');
            expect(
                basis(KR_EQUITY_SESSION, '2026-11-17', '2026-11-17T11:00:00Z')
            ).toBe('eod_published');
        });

        it('crypto: no EOD buffer, so just after 00:00Z the previous day is published', () => {
            expect(
                basis(CRYPTO_SESSION, '2026-11-17', '2026-11-18T00:00:30Z')
            ).toBe('eod_published');
            expect(
                basis(CRYPTO_SESSION, '2026-11-17', '2026-11-17T23:00:00Z')
            ).toBeNull();
        });

        it('intraday rows and rows without a subject anchor have no basis', () => {
            expect(
                basis(
                    US_EQUITY_SESSION,
                    '2026-11-20',
                    '2026-11-20T21:30:00Z',
                    '15Min'
                )
            ).toBeNull();
            expect(
                anchorCloseBasisOf(
                    SUBJECT(null),
                    new Date('2026-11-20T21:30:00Z'),
                    '1Day',
                    US_EQUITY_SESSION
                )
            ).toBeNull();
        });
    });

    it('intraday: closed once the bar length has elapsed from the bar start', () => {
        const barTime = Date.parse('2026-11-17T15:00:00Z') / 1000;
        const anchor = { barTime, close: 100 };
        const at = (iso: string) =>
            buildOutcomeAnchor(
                SUBJECT(anchor),
                new Date(iso),
                '15Min',
                US_EQUITY_SESSION
            );
        expect(at('2026-11-17T15:14:59Z')).toMatchObject({
            closedAtAnalysis: false,
        });
        expect(at('2026-11-17T15:15:00Z')).toMatchObject({
            closedAtAnalysis: true,
        });
    });
});
