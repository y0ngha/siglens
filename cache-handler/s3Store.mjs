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
    // cacheMaxMemorySize:0이라 Next 쪽 L1이 없다 — 핸들러 메모리 계층(memStore /
    // pageMemStore)을 놓친 read는 렌더 경로에서 S3를 대기한다. S3가 행(hang)하면 요청 전체가 멈추므로 connection/request 타임아웃과
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
    // 끊는다. 메모리 계층을 놓친 read는 S3를 기다리므로 이 경계가 없으면 mid-stream stall이
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

// 데이터(FETCH)는 배포를 넘어 공유하고 페이지는 빌드에 묶는다 — 근거와 버전 규칙은
// config.mjs `DATA_CACHE_VERSION`.
function s3Key(key, kind) {
    const isFetch = kind === 'FETCH';
    const scope = isFetch ? config.dataScope : config.buildId;
    const sub = isFetch ? 'fetch' : 'pages';
    const encoded = encodeURIComponent(key);
    // S3 키 1024바이트 한계 — 초과 시 sha256으로 대체(고유성 보존).
    const id =
        Buffer.byteLength(encoded) > S3_KEY_HASH_THRESHOLD
            ? createHash('sha256').update(key).digest('hex')
            : encoded;
    return `${config.keyPrefix}/${scope}/${sub}/${id}.cache`;
}

/**
 * S3 조회 결과를 상태와 함께 돌려준다.
 *
 * `status`:
 *   - `'hit'`       — 엔트리 있음
 *   - `'not-found'` — NoSuchKey/404. **이 경우만** 호출부가 네거티브 캐시에 넣는다.
 *   - `'error'`     — 그 밖의 실패(타임아웃·권한·역직렬화·zero-byte). 일시적일 수 있어
 *                     네거티브 캐시하지 않는다(fail-open: 재생성).
 *   - `'skipped'`   — 빌드 단계라 조회하지 않음.
 *
 * @returns {Promise<{ status: 'hit' | 'not-found' | 'error' | 'skipped', entry: any }>}
 */
export async function lookupEntry(key, kind) {
    // 빌드(prerender) 중에는 자격증명이 없어 모든 호출이 실패한다 — config.buildPhase 참고.
    if (config.buildPhase) return { status: 'skipped', entry: null };
    try {
        const res = await s3().send(
            new GetObjectCommand({
                Bucket: config.bucket,
                Key: s3Key(key, kind),
            })
        );
        // zero-byte 객체(Body 없음)는 throw가 아니라 miss로 취급한다.
        if (!res.Body) return { status: 'error', entry: null };
        const buf = Buffer.from(await res.Body.transformToByteArray());
        return { status: 'hit', entry: await deserialize(buf) };
    } catch (e) {
        if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404)
            return { status: 'not-found', entry: null };
        console.error('[isr-cache] s3 get failed', key, e.name, e.message);
        return { status: 'error', entry: null }; // fail-open: 재생성
    }
}

export async function getEntry(key, kind) {
    return (await lookupEntry(key, kind)).entry;
}

export async function setEntry(key, kind, entry) {
    if (config.buildPhase) return;
    try {
        await s3().send(
            new PutObjectCommand({
                Bucket: config.bucket,
                Key: s3Key(key, kind),
                Body: await serialize(entry),
            })
        );
    } catch (e) {
        // 업로드는 백그라운드(index.mjs `uploads`)라 여기서 삼켜도 응답과 무관하다.
        console.error('[isr-cache] s3 set failed', key, e.name, e.message);
    }
}

export const s3KeyForTest = s3Key;
