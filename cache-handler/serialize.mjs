import { gzipSync, gunzipSync } from 'node:zlib';
import {
    serialize as v8serialize,
    deserialize as v8deserialize,
} from 'node:v8';

// Next 16.2 cache values contain Buffer(rscData/body) + Map(segmentData) which JSON corrupts
// (response-cache/types.d.ts: IncrementalCachedAppPageValue.rscData/segmentData, CachedRouteValue.body).
// v8.serialize preserves Buffer/Map/typed-arrays/Date; gzip keeps RSC/HTML payloads compact.
export function serialize(obj) {
    return gzipSync(v8serialize(obj));
}

export function deserialize(buf) {
    return v8deserialize(gunzipSync(buf));
}
