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
    //
    // cacheMaxMemorySize:0이라 L1 메모리 캐시가 없다 — 모든 read가 렌더 경로에서 S3를
    // 대기한다. S3가 행(hang)하면 요청 전체가 멈추므로 connection/request 타임아웃과
    // 제한된 재시도로 경계를 둔다(SDK가 config-object form을 NodeHttpHandler로 해석).
    //
    // throwOnRequestTimeout:true가 핵심이다. @smithy/node-http-handler(4.8.2)는
    // 기본적으로 requestTimeout 초과 시 WARN 로그만 남기고 요청을 abort하지 않는다
    // (dist-cjs/index.js setRequestTimeout: throwOnRequestTimeout가 false면 logger.warn만).
    // true여야 req.destroy(error) + reject(error)로 행(hang)을 실제로 끊어 렌더 경로를
    // 풀어준다. 그렇지 않으면 느린/행 S3 응답이 2000ms 후에도 무한정 대기한다.
    //
    // socketTimeout:3000이 본문 다운로드(body) 구간을 경계한다. requestTimeout은
    // 응답 헤더 도착 시점까지만 유효하다 — 헤더가 오면 node-http-handler가
    // resolve({response})에서 clearTimeouts()를 호출해 requestTimeout을 취소한다
    // (dist-cjs/index.js: resolve→clearTimeouts→timing.clearTimeout(requestTimeoutId)).
    // 이후 res.Body.transformToByteArray() 스트림 read는 socketTimeout만이 경계한다.
    // setSocketTimeout(0<t<6000)은 request.socket.setTimeout(t, onTimeout)으로 네이티브
    // 소켓 비활성 타임아웃을 걸고 0을 반환하므로 clearTimeouts()가 취소하지 못한다 —
    // 본문 read 중 S3 stall이 나면 onTimeout이 request.destroy()+reject(TimeoutError)로
    // 끊는다. cacheMaxMemorySize:0(L1 없음)이라 이 경계가 없으면 mid-stream stall이
    // 렌더 경로를 무한정 멈춘다.
    client ??= new S3Client({
        region: config.region,
        maxAttempts: 2,
        requestHandler: {
            connectionTimeout: 1000,
            requestTimeout: 2000,
            socketTimeout: 3000,
            throwOnRequestTimeout: true,
        },
    });
    return client;
}

// S3 키 1024바이트 한계 아래 헤드룸(.cache 접미사 + prefix 길이 감안).
const S3_KEY_HASH_THRESHOLD = 900;

function s3Key(key, kind) {
    const sub = kind === 'FETCH' ? 'fetch' : 'pages';
    const encoded = encodeURIComponent(key);
    // S3 키 1024바이트 한계 — 초과 시 sha256으로 대체(고유성 보존).
    const id =
        Buffer.byteLength(encoded) > S3_KEY_HASH_THRESHOLD
            ? createHash('sha256').update(key).digest('hex')
            : encoded;
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
        // zero-byte 객체(Body 없음)는 throw가 아니라 miss로 취급한다.
        if (!res.Body) return null;
        const buf = Buffer.from(await res.Body.transformToByteArray());
        return await deserialize(buf);
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
                Body: await serialize(entry),
            })
        );
    } catch (e) {
        console.error('[isr-cache] s3 set failed', key, e.name, e.message); // 응답 flush 후라 삼킴
    }
}

export const s3KeyForTest = s3Key;
