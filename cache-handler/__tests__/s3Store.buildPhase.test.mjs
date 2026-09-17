import { vi } from 'vitest';

const { send } = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock('@aws-sdk/client-s3', () => ({
    S3Client: class {
        send = send;
    },
    GetObjectCommand: class {},
    PutObjectCommand: class {},
}));
// `next build` 중 자격증명 없는 도커 빌더에서 S3 호출이 전부 실패하던 상태를 재현한다.
vi.mock('../config.mjs', () => ({
    config: {
        bucket: 'test-bucket',
        region: 'ap-northeast-2',
        keyPrefix: 'siglens-isr',
        buildId: 'sha123',
        buildPhase: true,
    },
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { getEntry, setEntry } from '../s3Store.mjs';

beforeEach(() => send.mockReset());

describe('s3Store build phase', () => {
    it('빌드(prerender) 중에는 S3를 호출하지 않는다', async () => {
        await expect(getEntry('/AAPL', 'APP_PAGE')).resolves.toBeNull();
        await expect(
            setEntry('/AAPL', 'APP_PAGE', { value: 1 })
        ).resolves.toBeUndefined();
        expect(send).not.toHaveBeenCalled();
    });
});
