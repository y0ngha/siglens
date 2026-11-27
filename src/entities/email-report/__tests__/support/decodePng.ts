import { inflateSync } from 'node:zlib';

/** 테스트용 최소 PNG 디코더 — 8비트 RGB/RGBA, 비인터레이스만(next/og 출력 형태). */
export interface DecodedPng {
    width: number;
    height: number;
    /** 픽셀 `(x, y)`의 `[r, g, b, a]`. */
    pixel: (x: number, y: number) => [number, number, number, number];
}

const PNG_SIGNATURE_LENGTH = 8;

function paeth(a: number, b: number, c: number): number {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    return pb <= pc ? b : c;
}

export function decodePng(bytes: Uint8Array): DecodedPng {
    const buf = Buffer.from(bytes);
    let offset = PNG_SIGNATURE_LENGTH;
    let width = 0;
    let height = 0;
    let channels = 4;
    const idat: Buffer[] = [];
    while (offset < buf.length) {
        const length = buf.readUInt32BE(offset);
        const type = buf.toString('ascii', offset + 4, offset + 8);
        const data = buf.subarray(offset + 8, offset + 8 + length);
        if (type === 'IHDR') {
            width = data.readUInt32BE(0);
            height = data.readUInt32BE(4);
            const colorType = data[9];
            if (data[8] !== 8 || data[12] !== 0)
                throw new Error('unsupported PNG (need 8-bit, non-interlaced)');
            if (colorType === 2) channels = 3;
            else if (colorType === 6) channels = 4;
            else throw new Error(`unsupported PNG color type ${colorType}`);
        } else if (type === 'IDAT') idat.push(data);
        offset += 12 + length;
    }
    const raw = inflateSync(Buffer.concat(idat));
    const stride = width * channels;
    const out = Buffer.alloc(stride * height);
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        for (let i = 0; i < stride; i++) {
            const cur = raw[y * (stride + 1) + 1 + i];
            const left = i >= channels ? out[y * stride + i - channels] : 0;
            const up = y > 0 ? out[(y - 1) * stride + i] : 0;
            const upLeft =
                y > 0 && i >= channels
                    ? out[(y - 1) * stride + i - channels]
                    : 0;
            const add =
                filter === 0
                    ? 0
                    : filter === 1
                      ? left
                      : filter === 2
                        ? up
                        : filter === 3
                          ? (left + up) >> 1
                          : paeth(left, up, upLeft);
            out[y * stride + i] = (cur + add) & 0xff;
        }
    }
    return {
        width,
        height,
        pixel: (x, y) => {
            const at = y * stride + x * channels;
            return [
                out[at],
                out[at + 1],
                out[at + 2],
                channels === 4 ? out[at + 3] : 255,
            ];
        },
    };
}
