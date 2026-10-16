import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { UnzipSingleError, unzipSingle } from '../unzipSingle';

const FTD_EXCERPT =
    'SETTLEMENT DATE|CUSIP|SYMBOL|QUANTITY (FAILS)|DESCRIPTION|PRICE\n20260915|084670702|BRKB|4357|BERKSHIRE HATHWY INC(HLDG CO)B|514.95\n';

const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const CD_UNCOMPRESSED_SIZE_OFFSET = 24;

/** Rewrites every central-directory "uncompressed size" so the header understates the real size (a lying zip). */
function understateSizes(zip: Uint8Array, claimed: number): Uint8Array {
    const copy = zip.slice();
    const view = new DataView(copy.buffer);
    for (let i = 0; i + 4 <= copy.length; i += 1) {
        if (view.getUint32(i, true) === CENTRAL_DIRECTORY_SIGNATURE) {
            view.setUint32(i + CD_UNCOMPRESSED_SIZE_OFFSET, claimed, true);
        }
    }
    return copy;
}

describe('unzipSingle', () => {
    describe('when the zip holds exactly one file', () => {
        it('returns its name and inflated bytes', () => {
            const zip = zipSync({
                'cnsfails202609b.txt': strToU8(FTD_EXCERPT),
            });
            const entry = unzipSingle(zip, 1_000);
            expect(entry.name).toBe('cnsfails202609b.txt');
            expect(new TextDecoder().decode(entry.data)).toBe(FTD_EXCERPT);
        });

        it('ignores directory entries', () => {
            const zip = zipSync({
                'data/': {},
                'data/corpCode.xml': strToU8('<result/>'),
            });
            expect(unzipSingle(zip, 1_000).name).toBe('data/corpCode.xml');
        });
    });

    describe('when the zip does not hold exactly one file', () => {
        it('rejects two files', () => {
            const zip = zipSync({ a: strToU8('a'), b: strToU8('b') });
            expect(() => unzipSingle(zip, 1_000)).toThrow(
                'expected exactly one file in zip, found 2'
            );
        });

        it('rejects an empty archive', () => {
            expect(() => unzipSingle(zipSync({}), 1_000)).toThrow(
                UnzipSingleError
            );
        });
    });

    describe('size limit', () => {
        it('rejects an entry whose declared size exceeds the limit before inflating it', () => {
            const zip = zipSync({ big: new Uint8Array(2_000) });
            expect(() => unzipSingle(zip, 1_999)).toThrow(
                'zip entry big is 2000 bytes (limit 1999)'
            );
        });

        it('accepts an entry exactly at the limit', () => {
            const zip = zipSync({ edge: new Uint8Array(2_000) });
            expect(unzipSingle(zip, 2_000).data.byteLength).toBe(2_000);
        });

        it('bounds the output by the declared size when the header understates it (content checks catch the cut)', () => {
            const zip = understateSizes(
                zipSync({ liar: new Uint8Array(5_000) }),
                10
            );
            expect(unzipSingle(zip, 1_000).data.byteLength).toBe(10);
        });
    });

    it('propagates the decoder error for bytes that are not a zip', () => {
        expect(() => unzipSingle(strToU8('not a zip'), 1_000)).toThrow();
    });
});
