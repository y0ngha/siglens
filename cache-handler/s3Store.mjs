import { createHash } from 'node:crypto';
import {
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
} from '@aws-sdk/client-s3';
import { serialize, deserialize } from './serialize.mjs';
import { config } from './config.mjs';

/**
 * vi.fn(arrowImpl)을 `new` 없이도 호출 가능하게 하는 안전 생성 헬퍼.
 *
 * vitest 4.x는 vi.fn(arrowFn)을 `new`로 호출 시 Reflect.construct(arrowFn)이 실패한다.
 * 프로덕션에서는 `new`가 성공(AWS SDK 클래스). 테스트에서는 폴백으로 함수 호출.
 */
function construct(Ctor, args) {
    try {
        return new Ctor(...args);
    } catch (e) {
        if (
            e instanceof TypeError &&
            e.message.includes('is not a constructor')
        ) {
            return Ctor(...args);
        }
        throw e;
    }
}

let _client;
function s3() {
    // EC2 instance role 자격증명 자동 사용. region만 지정.
    _client ??= construct(S3Client, [{ region: config.region }]);
    return _client;
}

function s3Key(key, kind) {
    const sub = kind === 'FETCH' ? 'fetch' : 'pages';
    let id = encodeURIComponent(key);
    // S3 키 1024바이트 한계 — 초과 시 sha256으로 대체(고유성 보존).
    if (Buffer.byteLength(id) > 900)
        id = createHash('sha256').update(key).digest('hex');
    return `${config.keyPrefix}/${config.buildId}/${sub}/${id}.cache`;
}

export async function getEntry(key, kind) {
    try {
        const cmd = construct(GetObjectCommand, [
            { Bucket: config.bucket, Key: s3Key(key, kind) },
        ]);
        const res = await s3().send(cmd);
        const buf = Buffer.from(await res.Body.transformToByteArray());
        return deserialize(buf);
    } catch (e) {
        if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404)
            return null;
        console.error('[isr-cache] s3 get failed', key, e.name, e.message);
        return null; // fail-open: 재생성
    }
}

export async function setEntry(key, kind, entry) {
    try {
        const cmd = construct(PutObjectCommand, [
            {
                Bucket: config.bucket,
                Key: s3Key(key, kind),
                Body: serialize(entry),
            },
        ]);
        await s3().send(cmd);
    } catch (e) {
        console.error('[isr-cache] s3 set failed', key, e.name, e.message); // 응답 flush 후라 삼킴
    }
}

// 테스트 전용 — 키 스킴 검증.
export const s3KeyForTest = s3Key;
