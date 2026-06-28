import { createHash } from 'node:crypto';
import {
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
} from '@aws-sdk/client-s3';
import { serialize, deserialize } from './serialize.mjs';
import { config } from './config.mjs';

let client;
function s3() {
    // EC2 instance role 자격증명 자동 사용. region만 지정.
    client ??= new S3Client({ region: config.region });
    return client;
}

// S3 키 1024바이트 한계 아래 헤드룸(.cache 접미사 + prefix 길이 감안).
const S3_KEY_HASH_THRESHOLD = 900;

function s3Key(key, kind) {
    const sub = kind === 'FETCH' ? 'fetch' : 'pages';
    let id = encodeURIComponent(key);
    // S3 키 1024바이트 한계 — 초과 시 sha256으로 대체(고유성 보존).
    if (Buffer.byteLength(id) > S3_KEY_HASH_THRESHOLD)
        id = createHash('sha256').update(key).digest('hex');
    return `${config.keyPrefix}/${config.buildId}/${sub}/${id}.cache`;
}

export async function getEntry(key, kind) {
    try {
        const res = await s3().send(
            new GetObjectCommand({
                Bucket: config.bucket,
                Key: s3Key(key, kind),
            })
        );
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
        await s3().send(
            new PutObjectCommand({
                Bucket: config.bucket,
                Key: s3Key(key, kind),
                Body: serialize(entry),
            })
        );
    } catch (e) {
        console.error('[isr-cache] s3 set failed', key, e.name, e.message); // 응답 flush 후라 삼킴
    }
}

// 테스트 전용 — 키 스킴 검증.
export const s3KeyForTest = s3Key;
