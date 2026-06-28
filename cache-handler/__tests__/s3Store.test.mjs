import { vi } from 'vitest';

const { send } = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock('@aws-sdk/client-s3', () => ({
    S3Client: class {
        send = send;
    },
    GetObjectCommand: class {
        constructor(input) {
            this.__type = 'get';
            this.input = input;
        }
    },
    PutObjectCommand: class {
        constructor(input) {
            this.__type = 'put';
            this.input = input;
        }
    },
}));
vi.mock('../config.mjs', () => ({
    config: {
        bucket: 'test-bucket',
        region: 'ap-northeast-2',
        keyPrefix: 'siglens-isr',
        buildId: 'sha123',
    },
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { getEntry, setEntry, s3KeyForTest } from '../s3Store.mjs';
import { serialize } from '../serialize.mjs';

beforeEach(() => send.mockReset());

describe('s3Store key scheme', () => {
    it('pages/fetch kind를 prefix로 분리하고 buildId를 포함한다', () => {
        expect(s3KeyForTest('/AAPL', 'APP_PAGE')).toBe(
            'siglens-isr/sha123/pages/%2FAAPL.cache'
        );
        expect(s3KeyForTest('/AAPL', 'FETCH')).toBe(
            'siglens-isr/sha123/fetch/%2FAAPL.cache'
        );
    });

    it('짧은 키는 %2F encodeURIComponent 형태로 둔다', () => {
        const k = s3KeyForTest('/foo/bar', 'APP_PAGE');
        expect(k).toBe('siglens-isr/sha123/pages/%2Ffoo%2Fbar.cache');
    });

    it('900바이트 초과 키는 sha256 64-hex로 대체한다(S3 1024 한계)', () => {
        const longKey = '/' + 'a'.repeat(1000);
        const k = s3KeyForTest(longKey, 'APP_PAGE');
        expect(k).toMatch(/^siglens-isr\/sha123\/pages\/[0-9a-f]{64}\.cache$/);
    });
});

describe('getEntry', () => {
    it('NoSuchKey는 null을 반환한다(정상 miss)', async () => {
        send.mockRejectedValueOnce(
            Object.assign(new Error('nope'), { name: 'NoSuchKey' })
        );
        expect(await getEntry('/AAPL', 'APP_PAGE')).toBeNull();
    });

    it('기타 에러도 null을 반환한다(fail-open)', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        send.mockRejectedValueOnce(
            Object.assign(new Error('timeout'), { name: 'TimeoutError' })
        );
        expect(await getEntry('/AAPL', 'APP_PAGE')).toBeNull();
        expect(spy).toHaveBeenCalledWith(
            '[isr-cache] s3 get failed',
            '/AAPL',
            'TimeoutError',
            'timeout'
        );
        spy.mockRestore();
    });

    it('$metadata 404(이름 없는 에러)는 null을 반환한다', async () => {
        send.mockRejectedValueOnce(
            Object.assign(new Error('not found'), {
                $metadata: { httpStatusCode: 404 },
            })
        );
        expect(await getEntry('/AAPL', 'APP_PAGE')).toBeNull();
    });

    it('zero-byte 객체(Body 없음)는 miss로 null 반환(throw 안 함)', async () => {
        send.mockResolvedValueOnce({ Body: undefined });
        expect(await getEntry('/AAPL', 'APP_PAGE')).toBeNull();
    });

    it('저장된 엔트리를 역직렬화해 반환한다', async () => {
        const entry = { value: { html: 'hi' }, lastModified: 5, tags: ['t'] };
        const body = await serialize(entry);
        send.mockResolvedValueOnce({
            Body: { transformToByteArray: async () => body },
        });
        expect(await getEntry('/AAPL', 'APP_PAGE')).toEqual(entry);
    });
});

describe('setEntry', () => {
    it('PutObject로 직렬화해 저장한다', async () => {
        send.mockResolvedValueOnce({});
        await setEntry('/AAPL', 'APP_PAGE', {
            value: 1,
            lastModified: 9,
            tags: [],
        });
        expect(send).toHaveBeenCalledOnce();
        expect(send.mock.calls[0][0].input.Key).toBe(
            'siglens-isr/sha123/pages/%2FAAPL.cache'
        );
    });

    it('S3 에러를 삼킨다(fail-open, throw 안 함)', async () => {
        send.mockRejectedValueOnce(new Error('s3 down'));
        await expect(
            setEntry('/AAPL', 'APP_PAGE', {
                value: 1,
                lastModified: 9,
                tags: [],
            })
        ).resolves.toBeUndefined();
    });
});
