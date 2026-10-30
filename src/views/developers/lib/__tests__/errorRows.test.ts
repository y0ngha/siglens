import { describe, expect, it } from 'vitest';
import { API_ERROR_DOCS } from '@/entities/siglens-api-key/lib/apiErrorCatalog';
import { buildErrorRows } from '../errorRows';

const NOTE = 'streamed-note-fixture';

describe('buildErrorRows', () => {
    it('orders rows by status and keeps catalog order within a status', () => {
        const rows = buildErrorRows(NOTE);
        const statuses = rows.map(row => Number(row.term.split(' ')[0]));
        expect(statuses).toEqual(statuses.toSorted((a, b) => a - b));
        const catalog401 = API_ERROR_DOCS.filter(doc => doc.status === 401).map(
            doc => `401 ${doc.code}`
        );
        expect(
            rows.filter(row => row.term.startsWith('401 ')).map(row => row.term)
        ).toEqual(catalog401);
        expect(rows).toHaveLength(API_ERROR_DOCS.length);
    });

    it('pairs each status and code with its catalog summary', () => {
        const rows = buildErrorRows(NOTE);
        for (const doc of API_ERROR_DOCS)
            expect(
                rows.find(row => row.term === `${doc.status} ${doc.code}`)?.body
            ).toBe(doc.summary);
    });

    it('adds the note only to the codes the catalog marks as streamed', () => {
        const noted = buildErrorRows(NOTE)
            .filter(row => row.note === NOTE)
            .map(row => row.term);
        expect(noted.toSorted()).toEqual(
            [
                '422 analysis_failed',
                '500 tool_failed',
                '502 provider_error',
                '504 tool_timeout',
            ].toSorted()
        );
    });
});
