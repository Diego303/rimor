/**
 * Corpus de líneas de log reales sin secretos (IN-010): hashes de commit, UUID, sumas SHA-256, base64 de datos,
 * rutas, versiones e IP. Ninguna debe ocultarse; se admite menos del 2 % de falsos positivos.
 */
const base = [
  '2026-10-16T18:40:51.007Z INFO  gateway: request id=c19e0b77-2a41-4f6c-8d3e-5b9a7e214f08 model=llama3.1:8b',
  '2026-10-16T18:40:51.013Z WARN  http: response has no content-length, reading body to end',
  '2026-10-16T18:41:21.014Z ERROR stream: read timeout after 30000ms',
  'commit 9b1c3e7f2a4d6b8c0e1f3a5b7c9d2e4f6a8b0c1d',
  'Merge: 3fa2c91 7d8e9f0',
  'sha256:3fa2c9e1b7d84f60a2c5e9b1d7f3a8c6e4b2d0f9a7c5e3b1d9f7a5c3e1b9d7f5  rimor-0.1.0.zip',
  'Digest: sha256:4f8d2c6a9e1b3d5f7a0c2e4b6d8f1a3c5e7b9d0f2a4c6e8b1d3f5a7c9e0b2d4f',
  'npm notice integrity: sha512-Ac9Kq2Zt8Lm3Np4Qr7Wx1Yz6Bv5Cu0Dt9Es8Fr7Gq6Hp5Io4Jn3Km2Ll1Mk0Nj',
  'GET /v1/models 200 12ms ua="Mozilla/5.0 (X11; Linux x86_64)" ip=10.0.4.17',
  'connect 127.0.0.1:11434 in 4ms',
  'docker pull ghcr.io/rimor/gateway@sha256:9e7d5c3b1a0f8e6d4c2b0a9f7e5d3c1b0a8f6e4d2c0b9a7f5e3d1c0b8a6f4e2d',
  'Downloaded crate ureq v3.1.2 (registry `crates-io`) checksum 1f2e3d4c5b6a79881726354a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c',
  'thread "tokio-runtime-worker" panicked at src/gateway/stream.rs:142:17',
  '   3: struo_gateway::stream::next_chunk at ./src/gateway/stream.rs:142:17',
  'objectId: 507f1f77bcf86cd799439011 status: indexed',
  'trace_id=4bf92f3577b34da6a3ce929d0e0e4736 span_id=00f067aa0ba902b7',
  'X-Request-Id: 7c1a3e5b-9d2f-4a6c-8e0b-2d4f6a8c0e1b',
  'Set-Cookie: tema=oscuro; Path=/; SameSite=Lax',
  'Authorization header missing, returning 401',
  'user=ana role=admin action=export bytes=204800',
  'https://github.com/algesten/ureq/releases/tag/3.1.2',
  'postgres://db.interna:5432/rimor connected in 12ms',
  'level=info msg="cache miss" key=0x3fa2c9 took_ms=3',
  'base64 payload: SGVsbG8sIFJpbW9yLiBFc3RvIGVzIHVuIGVqZW1wbG8gZGUgdGV4dG8gbm9ybWFsLg==',
  'File: /home/diego/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.47.1/src/runtime/task/harness.rs',
  'ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"',
  'apiVersion: apps/v1 kind: Deployment name: rimor-gateway replicas: 2',
  'sk-learn version 1.5.2 loaded for skills indexing',
  'key=sk_test_mode disabled in production; using live config',
  'eyJ-like prefix detected in column header, ignored',
  'Bearer token rotated at 18:40 (value not logged)',
  'AKIA prefix appears in the docs of AWS IAM user names',
  'request 200 OK in 498ms tokens=96 reason=stop',
  'ws://localhost:4321/__vite_hmr connected',
  'Jenkins build #4123 finished: SUCCESS (b3f1a2c)',
];
const variantes: string[] = [];
for (let i = 0; i < 90; i++) {
  const id = `${(i * 2654435761).toString(16).padStart(8, '0').slice(-8)}-${(i * 40503).toString(16).padStart(4, '0').slice(-4)}-4${String(i).padStart(3, '0')}-a${String(
    i * 7,
  )
    .padStart(3, '0')
    .slice(-3)}-${(i * 97).toString(16).padStart(12, '0').slice(-12)}`;
  variantes.push(
    `2026-10-17T15:${String(22 + (i % 30)).padStart(2, '0')}:0${i % 10}.${String(i * 37)
      .padStart(3, '0')
      .slice(
        -3,
      )}Z INFO  gateway: response id=${id} status=200 in ${300 + i}ms commit=${(i * 7919).toString(16).padStart(7, '0')}`,
  );
}
export const LINEAS_LIMPIAS: string[] = [...base, ...variantes];
