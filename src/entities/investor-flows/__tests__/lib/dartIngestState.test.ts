import { describe, expect, it } from 'vitest';
import {
    EMPTY_DART_BACKFILL_CURSOR,
    EMPTY_DART_LIST_CURSOR,
    mergePending,
    parseDartBackfillCursor,
    parseDartListCursor,
    serializeDartBackfillCursor,
    serializeDartListCursor,
} from '../../lib/dartIngestState';

describe('dart list cursor', () => {
    it('round-trips through and the pending queue', () => {
        const cursor = {
            through: '2026-10-15',
            pending: [
                { corpCode: '00126380', attempts: 0 },
                { corpCode: '00160843', attempts: 2 },
            ],
        };
        expect(parseDartListCursor(serializeDartListCursor(cursor))).toEqual(
            cursor
        );
    });

    it.each([null, '', 'not json', '[]', '42', 'null'])(
        'reads %j as the empty cursor',
        raw => {
            expect(parseDartListCursor(raw)).toEqual(EMPTY_DART_LIST_CURSOR);
        }
    );

    it('drops malformed fields and entries but keeps the valid ones', () => {
        expect(
            parseDartListCursor(
                JSON.stringify({
                    through: '2026/10/15',
                    pending: [
                        { corpCode: '00126380', attempts: 1 },
                        { corpCode: '126380', attempts: 1 },
                        { corpCode: '00160843', attempts: -3 },
                        { corpCode: '00126380', attempts: 2 },
                        'x',
                    ],
                })
            )
        ).toEqual({
            through: null,
            pending: [
                { corpCode: '00126380', attempts: 2 },
                { corpCode: '00160843', attempts: 0 },
            ],
        });
    });
});

describe('mergePending', () => {
    it('keeps first-seen order and the larger attempt count', () => {
        expect(
            mergePending(
                [
                    { corpCode: '00000002', attempts: 1 },
                    { corpCode: '00000001', attempts: 0 },
                ],
                [
                    { corpCode: '00000003', attempts: 0 },
                    { corpCode: '00000002', attempts: 0 },
                ]
            )
        ).toEqual([
            { corpCode: '00000002', attempts: 1 },
            { corpCode: '00000001', attempts: 0 },
            { corpCode: '00000003', attempts: 0 },
        ]);
    });
});

describe('dart backfill cursor', () => {
    it('round-trips the last finished corp code', () => {
        expect(
            parseDartBackfillCursor(
                serializeDartBackfillCursor({ afterCorpCode: '00126380' })
            )
        ).toEqual({ afterCorpCode: '00126380' });
    });

    it.each([null, '{', '{"afterCorpCode":"abc"}'])(
        'reads %j as the start',
        raw => {
            expect(parseDartBackfillCursor(raw)).toEqual(
                EMPTY_DART_BACKFILL_CURSOR
            );
        }
    );
});
