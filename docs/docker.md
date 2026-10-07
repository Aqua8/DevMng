# Docker 이미지

DevMng 포털(프론트엔드 + 백엔드)을 하나의 이미지로 빌드한다. 실제 서버에 배포하지는 않고, 이미지가 만들어지고 컨테이너에서 동작하는 것까지를 범위로 한다.

## 빌드

저장소 루트에서 실행한다. 의존성 설치와 빌드까지 이미지 안에서 하므로 호스트에서 먼저 빌드할 필요가 없다.

```bash
docker build . -f packages/backend/Dockerfile -t devmng
# 또는: yarn build-image (packages/backend 에서 실행되는 같은 명령)
```

## 구조 (멀티스테이지)

| 단계       | 하는 일                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------- |
| `packages` | 각 패키지의 `package.json`만 남긴다. 소스가 바뀌어도 의존성 설치 캐시가 유지된다          |
| `build`    | 네이티브 모듈 빌드 도구를 설치하고 `yarn install --immutable`, `tsc`, `build:backend`     |
| `deps`     | 운영 의존성만 설치한다(`yarn workspaces focus --production`). 컴파일러는 이 단계에만 있다 |
| 최종       | `deps`의 `node_modules`와 빌드 결과, 설정, 카탈로그 정의만 담는다. 컴파일러가 없다        |

- `node` 사용자(권한이 낮은 계정)로 실행하고, `NODE_ENV=production`으로 동작한다.
- `HEALTHCHECK`가 `/.backstage/health/v1/readiness`를 30초마다 확인한다.
- `.dockerignore`가 `.env`, `*.local.yaml`, `node_modules`를 이미지에서 제외한다. 비밀 값은 이미지에 넣지 않고 실행할 때 환경 변수로 넘긴다.
- 카탈로그 정의(`catalog/`)는 이미지의 `/app/catalog`에 들어 있고, `app-config.production.yaml`이 그 경로를 가리킨다.

## 실행 (로컬 전용)

이 포털은 **내 컴퓨터에서만 접속하는 개인용**이다. `docker compose`로 포털과 Postgres를 함께 띄운다.

```bash
cp .env.example .env     # 값을 채운다 (POSTGRES_PASSWORD 필수, BOTMNG_* 는 BotMng 상태 카드를 쓸 때)
docker compose up -d --build
# 접속: http://localhost:7007  → ENTER 버튼으로 게스트 로그인
docker compose down      # 종료 (데이터는 유지, 지우려면 down -v)
```

- **포트는 `127.0.0.1`에만 열린다** (`docker-compose.yml`의 `127.0.0.1:7007:7007`). 같은 네트워크의 다른 기기에서는 접속되지 않는다.
- **게스트 로그인**: Backstage는 운영 모드에서 게스트 로그인을 막는다. 로컬 전용 설정 `app-config.docker-local.yaml`이 이를 풀어 준다. 이 설정은 compose가 `--config`로 추가할 때만 적용되고, 이미지의 기본 실행(운영 설정만)에는 들어가지 않는다.
- `.env`는 git과 이미지에서 제외된다. 비밀 값은 `.env`나 셸 환경 변수로만 넘긴다.
- BotMng 주소: 컨테이너 안에서 `127.0.0.1`은 컨테이너 자신이다. 호스트의 BotMng는 `host.docker.internal`로 접속할 수 있지만, BotMng 인증서가 공인 인증서가 아니면(자체 서명, Cloudflare Origin) 연결이 거부된다. 공개 주소를 쓰거나 BotMng 인증서를 컨테이너가 신뢰하게 설정한다.
- MCP를 함께 쓰려면 `app-config.mcp.example.yaml`을 읽기 전용으로 마운트하고 `--config`를 추가한다 (`docs/mcp.md` 참고).

## 확인한 것

- 정리 단계에서 운영 의존성 설치를 `deps` 단계로 분리해 실행 이미지에서 컴파일러를 뺐다. 이미지 크기가 **319MB에서 192MB**로 줄었고, 같은 방식으로 다시 실행해 동작을 확인했다(`better-sqlite3` 네이티브 모듈 로드 포함). 운영 의존성은 Backstage가 개발 의존성을 뺀 skeleton으로 설치해야 한다. 원본 `package.json`으로 설치하면 `@types` 같은 개발용 패키지까지 들어와 이미지가 3배가 된다.

- 이미지: Postgres 컨테이너와 함께 실행해 헬스체크 `healthy`, 실행 사용자 `node`, readiness 200, MCP 도구 2개, 카탈로그 프로젝트 3개와 의존 관계, BotMng 상태 `ok`, 토큰 없는 MCP 요청 401, 로그에 비밀 값 없음, 이미지 안에 `.env`·`*.local.yaml` 없음.
- `docker compose`: 포트가 `127.0.0.1`에만 바인딩됨(`docker port`), 브라우저에서 **게스트 로그인 → 카탈로그 → BotMng 페이지의 상태 카드("정상")**까지 동작.
- 같은 네트워크의 다른 기기에서 접속이 막히는지는 직접 시도하지 않았다(확인한 것은 `127.0.0.1`로만 바인딩된다는 점).

## 인터넷에 열 때 해야 할 것 (현재는 범위 밖)

위 구성은 로컬 전용이다. 다른 사람이나 다른 장소에서 접속하게 만들 때는 다음을 먼저 해야 한다.

- 게스트 로그인(`app-config.docker-local.yaml`)을 쓰지 않는다. 비밀번호가 없어서 주소를 아는 누구나 들어올 수 있다.
- 접속 경로를 제한한다: VPN/터널(Tailscale, SSH 터널), Cloudflare Access, 또는 Backstage에 GitHub 같은 실제 인증을 붙인다.
- HTTPS와 도메인을 설정한다 (이미지는 HTTP 7007만 연다).

보안 점검 결과와 남겨 둔 위험은 [`docs/security.md`](security.md)에 정리했다.
