import { gzip, gunzip } from 'node:zlib';
import { promisify } from 'node:util';
import {
    serialize as v8serialize,
    deserialize as v8deserialize,
} from 'node:v8';

// gzip/gunzip은 비동기(promisify)로 돌려 이벤트 루프를 막지 않는다.
// 이 코드는 read 경로(getEntry)에서 실행되며, 큰 RSC 페이로드의 압축 해제는
// gzipSync/gunzipSync일 경우 메인 스레드를 수십 ms 블로킹할 수 있다.
// 비동기 zlib는 libuv 스레드풀에서 실행되므로 렌더 스레드를 풀어준다.
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

// Next 16.2 cache values contain Buffer(rscData/body) + Map(segmentData) which JSON corrupts
// (response-cache/types.d.ts: IncrementalCachedAppPageValue.rscData/segmentData, CachedRouteValue.body).
// v8.serialize preserves Buffer/Map/typed-arrays/Date; gzip keeps RSC/HTML payloads compact.
//
// 주의: v8.serialize/deserialize는 비동기 API가 없다(CPU 바운드, 불가피).
// gzip만 비동기화해 가장 큰 블로킹 구간(대형 RSC 페이로드 압축 해제)을 제거한다.
export async function serialize(obj) {
    return gzipAsync(v8serialize(obj));
}

export async function deserialize(buf) {
    return v8deserialize(await gunzipAsync(buf));
}
