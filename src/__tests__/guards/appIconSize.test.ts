import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `src/app/icon.png`는 Next 파일 규약으로 **모든 페이지**의 `<link rel="icon">`이 된다.
 *
 * 예전에는 1024×1024 원본(206KB)이 그대로 있었다. Next는 이 파일을 리사이즈하지 않고
 * `sizes="1024x1024"`로 그대로 광고하므로, 가장 큰 아이콘을 고르는 브라우저(Safari 등)는
 * 탭 아이콘 하나에 206KB를 받았다. 탭·북마크·검색 결과 파비콘에는 192px이면 충분하다
 * (구글 검색 파비콘 권장: 48의 배수). 홈 화면 아이콘은 매니페스트(`icon192/512.png`)와
 * `apple-icon.png`가 따로 맡는다.
 */
const PNG_WIDTH_OFFSET = 16;
const PNG_HEIGHT_OFFSET = 20;
const MAX_EDGE_PX = 192;
const MAX_BYTES = 32 * 1024;

describe('src/app/icon.png', () => {
    const file = readFileSync(join(process.cwd(), 'src/app/icon.png'));

    it('파비콘 크기(≤192px 정사각형)다', () => {
        const width = file.readUInt32BE(PNG_WIDTH_OFFSET);
        const height = file.readUInt32BE(PNG_HEIGHT_OFFSET);
        expect(width).toBe(height);
        expect(width).toBeLessThanOrEqual(MAX_EDGE_PX);
        expect(width % 48).toBe(0);
    });

    it('32KB를 넘지 않는다', () => {
        expect(file.byteLength).toBeLessThanOrEqual(MAX_BYTES);
    });
});
