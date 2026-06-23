# Vercel → AWS 마이그레이션 설계 (siglens Next.js 앱)

- 작성일: 2026-06-24
- 범위: **siglens Next.js 앱만** (Vercel → AWS EC2). 워커(siglens-worker, GCP Cloud Run → AWS)는 **별도 spec**
- 상태: 설계 승인 대기 → 승인 후 writing-plans

---

## 0. 배경 & 목표

현재 siglens는 Vercel(Pro)에서 호스팅되며 2026년 6월 실측 청구 ≈ **$345/월**(6/11 $220.01 + 6/23 $125.35). 비용의 80%가 **ISR Writes($129) + Fast Origin Transfer($120)** — 둘 다 Vercel 고유 단위 과금이며 self-host 시 디스크 쓰기·in-process로 전환돼 과금 자체가 소멸한다.

**목표**: Vercel 기능을 100% 유지하면서 호스팅 비용을 대폭 절감. CloudFlare(DNS+WAF+CDN)는 그대로 유지. 외부 의존성(Neon Postgres·Upstash Redis·GCP 워커)은 호스트와 무관하게 유지.

**안정성 우선 원칙**: 무중단 배포·자동복구를 갖춘 구성을 선택(ALB+ASG). 변경 표면 최소화.

---

## 1. 핵심 결정 로그

| # | 결정 | 근거 |
|---|---|---|
| D1 | **단일 EC2 t4g.medium + ALB + 로컬 EBS** | 리서치상 ISR 로컬 디스크 캐시(24.9M writes/월 무료)를 네이티브 지원하는 유일한 옵션 (§4) |
| D2 | 리전 **ap-northeast-2 (서울)**, Neon은 싱가포르 유지 | 서울↔싱가포르 RTT ~70–90ms 수용. ISR 캐시 서빙은 DB 미경유, 재생성 때만 호출 |
| D3 | 패키징 **Docker(arm64) + ECR + SSM** | 빌드는 CI에서(인스턴스 OOM 방지), 재현성 |
| D4 | 배포 트리거 **`v*` 태그 push** (`yarn release` / release-it) | 기존 Vercel `ignoreCommand`(chore: release만 빌드)와 동일 시맨틱 |
| D5 | 배포 = **ASG instance refresh** (수동 승인 게이트 없음) | 자동 게이트 2겹(빌드 실패 + ALB 헬스체크 `MinHealthyPercentage:100`)이 대체 |
| D6 | **Claude가 AWS CLI 구동**, IAM 주체는 사용자 발급 | 보안 경계: 제가 IAM 주체·권한 생성 불가 |
| D7 | **Route53 미사용** — DNS는 CloudFlare 권한자 유지 | WAF/캐시 위해 CF 필수. ALB DNS 고정이라 CNAME만 |
| D8 | 시크릿 **SSM Parameter Store SecureString** (무료) | Secrets Manager($0.40/secret) 대비 28개=무료 |
| D9 | **단일 env 세트**(=prod 백엔드), beta=prod앱을 테스트 호스트명으로 | beta가 실제 prod 백엔드 검증 |
| D10 | OAuth: `OAUTH_REDIRECT_BASE_URL=https://siglens.io` 고정 | beta OAuth 미검증(사용자 수용), 컷오버 후 자동 동작. Google/Kakao beta 콜백 미등록 |
| D11 | 오리진 **On-Demand 시작 → 안정화 후 1yr Compute Savings Plan** | Spot은 단일 오리진에 부적합(회수=장애). SP가 중단 위험 0으로 ~27–30% 절감 |
| D12 | 수요 기반 오토스케일 **미설계**, ASG는 자동복구+배포용(min1/max2) | 피크 1.24 req/s, 평균 0.14코어 → 스케일아웃 불필요(+멀티인스턴스 캐시 함정) |
| D13 | **ALB 유지** (bare EC2 대비 +$28/월) | 무중단 배포+자동복구+안정 endpoint. 프로덕션 금융 사이트 안정성 우선 |

---

## 2. 리서치 검증 요약 (2026)

4개 병렬 리서치로 "현재 설계가 2026 기준 최적인가"를 검증. 출처는 각 항목 말미.

### 2.1 대안 아키텍처 — 전부 더 나쁨

| 대안 | 평가 | 핵심 |
|---|---|---|
| **OpenNext serverless** (Lambda+CF+S3+DynamoDB) | ❌ Vercel 청구서 재현 | write-bound라 24.9M writes = S3 PUT $124 + Lambda $106 + DDB/SQS $25 ≈ **$260–330/월**. 단일 서버는 재생성이 공짜 CPU → EC2 ~6배 저렴 |
| **App Runner** | ❌ **2026.4.30 신규가입 종료** | + ephemeral FS로 ISR 캐시 못 남김. 대체=ECS Express Mode |
| **ECS Fargate** | ❌ EFS 필요 | persistent하려면 EFS → 24.9M writes 과금 → 무의미 |
| **Lightsail Containers** | ❌ stateless | 디스크 부착 불가 |
| **단일 EC2 + 로컬 EBS** | ✅ 채택 | 무료 로컬 디스크 ISR 쓰기를 네이티브 지원하는 유일 옵션 |

### 2.2 2026 AWS 변경 사실 (가격 반영)

- **Graviton 버스터블은 t4g가 최신**(t5g 없음). t4g.medium 서울 = **$0.0416/h ≈ $30.4/월**, t4g.small $0.0208/h ≈ $15.2/월
- **공용 IPv4 과금 $0.005/h ≈ $3.65/월·IP** (2024~, 2026 유효). EC2 EIP 1개 + ALB 2-AZ 2개 = IPv4 세금 ~$11/월
- **SSM Standard SecureString 무료** 확인
- **서울 egress $0.126/GB**(프리미엄 리전), 100GB/월 무료 유지
- **Compute Savings Plan(1yr no-upfront) ~27–30%** 할인(이전 가정 40%보다 보수적)
- EBS gp3 서울 ~$0.0912/GB, 3000 IOPS+125MB/s 무료 포함

### 2.3 Next.js 16 self-host 패리티 — 실코드 검증 완료 (§9)

프레임워크 동작은 Vercel/EC2 동일. 우리 앱은 이미 v16-idiomatic이라 변경 표면이 6개 소항목뿐.

> 출처: Next.js 16 self-hosting 가이드(v16.2.9), OpenNext docs/releases, AWS pricing 페이지, App Runner availability change. 상세 URL은 리서치 산출물 참조.

---

## 3. 목표 아키텍처

```
                    ┌─────── CloudFlare (DNS + WAF + Free CDN, 현행 유지) ───────┐
  사용자 ──TLS──▶   │  Universal SSL · WAF 3룰 · 캐시룰 · cf-connecting-ip        │
                    └──────────────────────────┬─────────────────────────────────┘
                                                │ Origin TLS (Full Strict, SNI=도메인)
                                                │ (ALB SG: CF IP 대역만 인바운드)
                                                ▼
                          ┌──────── AWS ap-northeast-2 (서울) ────────┐
                          │   ALB (HTTPS:443, ACM 인증서, 2 AZ)        │
                          │     └─ Target Group → /api/health         │
                          │            │                              │
                          │            ▼                              │
                          │   EC2 t4g.medium (ASG min1/max2, 공용 IP) │
                          │     Docker(tini): Next16 standalone :3000 │
                          │     로컬 EBS gp3 30GB = ISR 캐시          │
                          │     IAM Role: ECR pull · SSM · SSM Param  │
                          └───────────────┬──────────────────────────┘
                                          │ 외부(불변)
            ┌─────────────────┬───────────┴───────────┬──────────────────┐
            ▼                 ▼                       ▼                  ▼
       Neon Postgres     Upstash Redis         siglens-worker      OAuth/Resend/FMP
       (싱가포르)         (REST)               (GCP Cloud Run)      /Gemini (외부)
```

**신규 생성 컴포넌트**: ECR(리포+lifecycle keep-3), EC2 t4g.medium(ASG), ALB+TG, ACM 인증서, SSM Parameter Store `/siglens/*`, IAM 3주체, CloudWatch Logs+알람.

**의도적 제외(YAGNI)**: Route53, NAT Gateway, EFS/ElastiCache, 공유 캐시(cacheHandler/Redis), 수요 오토스케일.

---

## 4. 비용 분석

### 4.1 현재 Vercel (6월 인보이스 실측, subtotal $313.95)

| 항목 | 사용량 | 비용 |
|---|---|---|
| ISR Writes | 24,898,346 | $129.47 |
| Fast Origin Transfer | 449.67 GB | $120.18 |
| Observability Events | 17.4M | $20.91 |
| Fluid Active CPU | 104.8 CPU-h | $20.03 |
| Fluid Provisioned Memory | 1,215 GB-Hr | $18.90 |
| 기타(Functions·ISR Reads·Edge·Build) | — | ~$4 |
| **월 총액(2건 인보이스)** | | **~$345** |

### 4.2 AWS 견적 (ap-northeast-2, ALB 구성)

| 항목 | On-Demand | 1yr Savings Plan |
|---|---|---|
| EC2 t4g.medium | $30.4 | ~$21 |
| ALB (base $16.4 + LCU ~$4 + IPv4 2×$3.65) | $27.7 | $27.7 |
| EC2 공용 IP (egress용, 퍼블릭 서브넷) | $3.65 | $3.65 |
| EBS 30GB gp3 | $2.74 | $2.74 |
| Data egress (origin→CF 미스 ~50GB 과금분) | ~$7 | ~$7 |
| ECR | <$1 | <$1 |
| SSM / CloudWatch(경량) | ~$0–2 | ~$0–2 |
| **합계** | **~$73/월** | **~$63/월** |

- 추후 **right-sizing**(medium→small) 시 SP 기준 **~$50/월**까지
- **Vercel 대비 ~78–82% 절감**(연 $3,200~3,400 절약)

> 주의: 서울 ALB/EBS/egress 정확 단가는 콘솔/Pricing Calculator로 최종 확인 권장(JS 렌더 페이지라 일부 third-party 집계 사용).

---

## 5. IAM / 신원 / 권한

**경계**: IAM 주체(사용자·역할·정책) 생성은 **사용자**가 수행. 그 외 인프라는 Claude가 CLI로 프로비저닝.

### 5.1 3개 IAM 주체

| 주체 | assume 주체 | 용도 | 생성 |
|---|---|---|---|
| ① `siglens-deployer` (IAM 사용자) | Claude 로컬 `aws` 프로파일 | 인프라 생성/관리 | 사용자 |
| ② `siglens-ec2-role` (역할) | EC2 인스턴스 | ECR pull·시크릿 읽기·로그 | 사용자 |
| ③ `siglens-ci-deploy` (역할) | GitHub Actions(OIDC) | 이미지 push·배포 트리거 | 사용자 |

### 5.2 사용자가 직접 생성 (Claude가 정책 JSON 제공)

1. **`siglens-deployer`** + access key. 권한: ECR/EC2/ELBv2/AutoScaling/ACM/SSM/CloudWatch Logs **풀** — **IAM 액션 제외**(제 CLI가 권한 변경 못 하도록). access key는 사용자가 `aws configure --profile siglens`에 설정(키 값 Claude 미열람)
2. **`siglens-ec2-role`** (least privilege):
   - 관리형 `AmazonSSMManagedInstanceCore`
   - ECR pull: `ecr:GetAuthorizationToken`, `BatchGetImage`, `GetDownloadUrlForLayer`
   - 시크릿: `ssm:GetParametersByPath` on `arn:aws:ssm:ap-northeast-2:*:parameter/siglens/*` + `kms:Decrypt`
   - 로그: `logs:CreateLogStream`, `PutLogEvents`
3. **GitHub OIDC provider** (`token.actions.githubusercontent.com`)
4. **`siglens-ci-deploy`**:
   - 신뢰: 위 OIDC + `repo:y0ngha/siglens:ref:refs/tags/v*` (태그 push로 제한)
   - 권한: ECR push(`ecr:*UploadLayer`, `PutImage`, `BatchCheckLayerAvailability`, `GetAuthorizationToken`) + 배포(`ec2:CreateLaunchTemplateVersion`, `autoscaling:StartInstanceRefresh`, `autoscaling:Describe*`)
5. **GitHub repo secret**: `AWS_DEPLOY_ROLE_ARN`(③ ARN), `SIGLENS_GITHUB_TOKEN`(core 비공개 패키지 — 기존 토큰)

### 5.3 시크릿 인벤토리

| 시크릿 | 위치 | 비고 |
|---|---|---|
| 28개 서버 env | SSM `/siglens/*` (SecureString) | 무료, 인스턴스 역할로 읽음 |
| `SIGLENS_GITHUB_TOKEN` | GitHub Actions secret + docker build secret | 빌드 전용 |
| AWS 프로비저닝 키 | 로컬 `aws` 프로파일만 | Claude 미열람 |
| CI→AWS 인증 | OIDC(정적키 없음) | 유출면 0 |

---

## 6. 패키징 & CI/CD

### 6.1 Dockerfile (멀티스테이지, arm64)

- builder: node:20-alpine + corepack yarn, `SIGLENS_GITHUB_TOKEN` 시크릿으로 core 설치, prebuild(backtesting), `next build`(standalone)
- runner: `.next/standalone` + **`.next/static` + `public/` + `skills/**` 복사**, **`sharp` 설치**, **tini**(PID1 SIGTERM 전달), `EXPOSE 3000`, `CMD ["node","server.js"]`
- **빌드 후 assertion**: `skills/**`가 `.next/standalone`에 존재하는지 확인(런타임 fs 읽기 트레이싱 누락 방지)

### 6.2 이미지 전략 — 단일 이미지 promote

- 빌드 1회 → beta·prod 동일 이미지(검증=배포 보장)
- `NEXT_PUBLIC_*`는 빌드타임 인라인 → `NEXT_PUBLIC_SITE_URL=https://siglens.io` 박음(beta noindex)
- 서버 env는 런타임 SSM 주입
- 이미지 태그 = `vX.Y.Z`(릴리스 버전) + git SHA

### 6.3 ECR lifecycle (keep last 3)

```json
{ "rules": [{ "rulePriority": 1, "description": "Keep last 3 images",
  "selection": { "tagStatus": "any", "countType": "imageCountMoreThan", "countNumber": 3 },
  "action": { "type": "expire" } }] }
```

### 6.4 CI/CD 플로우

```
yarn release (release-it) → "chore: release vX.Y.Z" 커밋 + vX.Y.Z 태그 + git push --tags
   ▼
GitHub Actions  on: push: tags: ['v*']   (일반 master push는 무시)
   │ 1. docker buildx(arm64) → ECR push (tag: vX.Y.Z + SHA)   ← 빌드 실패=배포 중단(게이트1)
   │ 2. deploy(OIDC role): create-launch-template-version(image=vX.Y.Z)
   │                       → start-instance-refresh (MinHealthyPercentage:100, stopTimeout 30s)
   ▼
ASG instance refresh: 새 인스턴스 부팅→ALB 헬스 통과→트래픽 이동→old 드레인  ← 헬스 실패=old 유지(게이트2)
```

- **수동 승인 게이트 없음**. 자동 게이트 2겹(빌드 실패, ALB 헬스체크)이 깨진 배포를 차단
- **롤백**: 이전 `vX.Y.Z`로 deploy 재실행
- 빌드 아키텍처: GitHub **arm64 호스티드 러너** 네이티브 빌드(권장), 대안 buildx+QEMU

---

## 7. 네트워킹 / TLS / DNS

### 7.1 VPC / 서브넷

- 기본 VPC(서울), 퍼블릭 서브넷 2개(2a, 2c — ALB ≥2 AZ 요구)
- EC2는 퍼블릭 서브넷 + 공용 IP(아웃바운드 직접) → **NAT Gateway 불필요**

### 7.2 보안 그룹 (origin 직접 노출 차단)

| SG | 인바운드 |
|---|---|
| ALB SG | 443 ← **CloudFlare IP 대역만** (직접 ALB 접근=WAF 우회 방지) |
| EC2 SG | 3000 ← **ALB SG만** |

- 아웃바운드: 443(ECR/SSM/CloudWatch/Upstash/OAuth/FMP/Gemini/Resend/Worker) + 5432(Neon)
- **추가 방어(권장)**: CF Transform Rule로 비밀 헤더 주입 + ALB 리스너 룰이 없으면 403

### 7.3 TLS

- 체인: 사용자 →(CF Universal SSL)→ CF →(Full Strict, SNI=도메인)→ ALB(ACM, 443)
- **ACM 단일 SAN 인증서**(서울): `beta.siglens.io` + `siglens.io` + `www.siglens.io`. DNS 검증(CF에 CNAME)
- ALB HTTPS:443 리스너 + ACM. CF SSL 모드 Full(Strict) 유지

### 7.4 DNS (CloudFlare)

| 단계 | 레코드 | 값 | 프록시 |
|---|---|---|---|
| 상시 | ACM 검증 CNAME | (ACM 제공) | grey |
| beta 검증 | `beta.siglens.io` CNAME | ALB DNS | 🟠 |
| (이 동안) | `siglens.io`/`www` | Vercel 유지 | 🟠 |
| 컷오버 | `siglens.io`(CNAME flattening)+`www` | ALB DNS로 변경 | 🟠 |
| 롤백 | 위 → Vercel | 즉시 | 🟠 |

### 7.5 CF 설정 점검

- WAF 3룰·HTML Cache Rule 유지(host 기반). **beta에서 캐시 룰이 ALB origin 헤더와 정상 동작 실측 검증**(Vercel 특유 헤더 가정 없는지)
- **beta noindex**: CF Transform Rule로 `X-Robots-Tag: noindex`(beta host)

---

## 8. 설정 / 시크릿 / env

### 8.1 단일 env (=prod 백엔드)

인스턴스 1개, beta→prod는 DNS만 변경. env도 1벌(prod Neon/Upstash/Worker). beta는 prod 앱을 테스트 호스트명으로 접근하는 진짜 검증.

### 8.2 SSM 주입 (앱 AWS-agnostic)

- `/siglens/<KEY>` SecureString. 인스턴스 역할이 `GetParametersByPath`
- **호스트 측**(user-data/systemd ExecStartPre)이 SSM fetch → `/run/siglens.env` → `docker run --env-file`. 앱은 `process.env`만 읽음(코드 변경 0, 이미지 클라우드 중립)
- 로테이션: SSM 갱신 → instance refresh(또는 SSM Run Command 재fetch+재시작)

### 8.3 빌드타임 vs 런타임

| 분류 | 변수 | 위치 |
|---|---|---|
| 빌드타임 인라인 | `NEXT_PUBLIC_*`(SITE_URL/ADSENSE/SITE_VERIFICATION) | CI build arg |
| 빌드타임 설치 | `SIGLENS_GITHUB_TOKEN` | GH secret + docker build secret |
| 런타임 서버 | DB·OAuth·암호화키·FMP·Gemini·Upstash·RESEND·WORKER 등 | SSM `/siglens/*` |

### 8.4 OAuth

- `OAUTH_REDIRECT_BASE_URL=https://siglens.io` 고정(SSM)
- beta OAuth 로그인 미검증(사용자 수용). 컷오버 후 siglens.io→AWS면 자동 정상. **컷오버 직후 로그인 1건 최우선 스모크**
- Google/Kakao beta 콜백 등록 **불필요**(사용자 결정)

### 8.5 cron 없음

`cleanupExpiredSessionsAction`(CRON_SECRET)은 자동 트리거 부재로 만료 세션 누적(무해). 추후 워커 spec에서 처리. CRON_SECRET은 SSM 보존.

---

## 9. Next.js 16 self-host 패리티 (실코드 검증 완료)

### 9.1 이미 커버됨 (코드 확인)

| 항목 | 코드 상태 |
|---|---|
| middleware→proxy | `src/proxy.ts` 존재 ✅ |
| `revalidateTag` 2번째 인자 | 모든 호출 `(tag, 'max')` ✅ |
| async request API | sync 호출 0, await 25곳 ✅ |
| Turbopack(webpack 충돌) | webpack 설정 없음 ✅ |
| cacheComponents/PPR/`'use cache'` | 비활성, 실 디렉티브 0(주석만) ✅ |
| `connection()` ISR 500 | 실코드 0 ✅ |
| 이미지 | `remotePatterns`만(deprecated `domains` 미사용), 새 기본값 이미 적용 중 ✅ |
| sitemap/robots | route handler(`api/sitemap`,`robots.ts`), `generateSitemaps` 미사용 ✅ |
| `NEXT_PUBLIC_*` | 런타임 가변 불필요 → 단일 이미지 OK ✅ |
| on-demand revalidation | `revalidateTag` 다수, 단일 인스턴스 정상 ✅ |

### 9.2 self-host 추가 항목 (6개, 소규모)

1. **`sharp`** 추가(deps, **runner 스테이지**) — 현재 ABSENT
2. **tini/`--init`** Docker — SIGTERM→PID1 node 전달(Next standalone 기본 graceful 핸들러) + ASG stopTimeout 30s
3. **`compress: false`** next.config(CF brotli 이중압축 방지)
4. **`output: 'standalone'`** + **`/api/health`**(`dynamic='force-dynamic'`, DB 미경유 shallow)
5. 빌드 후 **`skills/**` standalone 포함 assertion**
6. (선택) sharp glibc jemalloc 메모리 튜닝

---

## 10. 컷오버 / 롤백

| Phase | 내용 | siglens.io DNS | Vercel |
|---|---|---|---|
| 0. 프로비전 | AWS 인프라+이미지 배포, ALB 타깃 healthy, ALB DNS 직접 1차 점검 | Vercel | 가동 |
| 1. beta 검증 | CF `beta.siglens.io`→ALB. 체크리스트(§10.1) | Vercel | 가동 |
| 2. 컷오버 | CF `siglens.io`+`www`→ALB. 스모크(OAuth 로그인 1건) | **ALB** | **가동(롤백용)** |
| 3. 안정화 | N일 모니터(5xx·지연·핵심 플로우) | ALB | 가동 |
| 4. 해제 | Vercel git 연동 해제 + 프로젝트 비활성, `vercel.json` 제거 | ALB | 해제 |

### 10.1 beta 검증 체크리스트

- [ ] 핵심 라우트 SSR/ISR(심볼·탭·홈), **ISR 재생성→로컬 EBS 기록** 확인
- [ ] Neon(서울→싱가포르) 지연 체감, Upstash, **Worker 분석 잡** 호출
- [ ] `next/image`(sharp), 헬스체크 green, CloudWatch 로그 유입
- [ ] **CF 캐시 룰이 ALB origin 헤더와 정상 동작**
- [ ] beta noindex(`X-Robots-Tag`)
- [ ] 가벼운 부하 스모크
- [ ] **롤백 드릴 1회**(beta DNS flip)

### 10.2 롤백

- 트리거: 5xx 급증·핵심 플로우 손상·DB 지연·OOM
- 메커니즘: CF `siglens.io`→Vercel 즉시 repoint. Vercel은 Phase 3까지 가동
- 컷오버는 저트래픽 윈도우(미국 장외/한국 새벽)

---

## 11. 앱 코드 변경 (최종)

1. `next.config.ts`: `output: 'standalone'`, `compress: false`
2. `app/api/health/route.ts` 신규(`dynamic='force-dynamic'`, shallow 200)
3. `package.json`: `sharp` 추가
4. `Dockerfile`·`.dockerignore` 신규

> OAuth·proxy·revalidateTag·이미지 등은 **변경 없음**(이미 v16 호환).

---

## 12. IaC 스크립트 인벤토리 (`infra/aws/`)

| 파일 | 역할 | 실행 |
|---|---|---|
| `iam/*.json` + `00-prereqs.md` | 3주체 정책 + 절차 | 사용자 |
| `01-ecr.sh` | ECR 리포 + lifecycle(keep 3) | Claude |
| `02-network.sh` | SG(ALB=CF IP, EC2=ALB), 서브넷 | Claude |
| `03-acm.sh` | 인증서 요청 + 검증 CNAME 출력 | Claude |
| `04-params.sh` | 로컬 env → SSM `/siglens/*` | Claude |
| `05-launch-template.sh` + `user-data.sh` | LT + 부팅(docker·SSM fetch·ECR run) | Claude |
| `06-alb-asg.sh` | ALB·TG·리스너·ASG(min1/max2) | Claude |
| `deploy.sh` | LT 새 버전 + instance-refresh | Claude/CI |
| `Dockerfile`·`.dockerignore` | arm64 멀티스테이지 | Claude |
| `.github/workflows/deploy.yml` | `v*` 태그 → build→ECR→deploy | Claude |

---

## 13. 변경/생성 문서

| 문서 | 변경 |
|---|---|
| `docs/architecture/INFRA_AWS.md` 신규 | 런북: 프로비전·배포·롤백·시크릿·right-sizing·SP |
| `docs/architecture/CDN_CACHING.md` | origin Vercel→ALB |
| `docs/architecture/ISR_REVALIDATE.md` | ISR 캐시=로컬 EBS, Vercel ISR Writes 과금 소멸 |
| `docs/architecture/PERFORMANCE_BASELINE.md` | 호스팅·비용 baseline |
| `CLAUDE.md` | 호스팅=AWS, 배포 트리거(`v*` 태그→GH Actions) |
| `vercel.json` | Phase 4 제거 + Vercel git 연동 해제 |

---

## 14. 테스트 / 검증

- **CI(불변)**: `ci.yml`(vitest)+`e2e.yml`(Playwright) — 깨지면 이미지 빌드 안 됨
- **빌드 검증**: 이미지 로컬 기동→`/api/health` 200, `skills/**`·`public/backtesting` 포함, sitemap 동작, SIGTERM graceful 드레인 확인
- **로컬 컨테이너 스모크**: prod-like env로 핵심 라우트 curl
- **beta 검증**: §10.1
- **컷오버 후**: OAuth·핵심 플로우 + CloudWatch/CF/ALB 모니터

---

## 15. 모니터링 / 알람

CloudWatch 알람 3개: ALB 5xx율 · 타깃 unhealthy · t4g CPU 크레딧 잔량. 메모리 알람은 CloudWatch agent RSS 수집 후 추가. SNS→이메일 옵션.

---

## 16. 미결/후속

- **워커 이관(별도 spec)**: siglens-worker(GCP Cloud Run) → **ECS Fargate(+Fargate Spot)**. 앱 안정화 후. 분석 잡 idempotent라 Spot 적합
- **right-sizing**: 1~2주 RSS/CPU 실측 → medium→small 검토 + 1yr Compute Savings Plan 구매
- **ISR write:read 15:1 레버**(참고): 24.9M 쓰기 vs 1.66M 읽기. EC2에선 공짜 CPU지만, 줄이면 small 다운사이즈 여유. 사용자=이미 튜닝됨, right-sizing 단계에서 재검토
- **Neon 리전**(선택): 추후 Tokyo `ap-northeast-1`로 옮기면 RTT ~35ms + egress 절감
