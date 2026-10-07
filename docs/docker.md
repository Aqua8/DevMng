# Docker 이미지

DevMng 포털(프론트엔드 + 백엔드)을 하나의 이미지로 빌드한다. 실제 서버에 배포하지는 않고, 이미지가 만들어지고 컨테이너에서 동작하는 것까지를 범위로 한다.

## 빌드

저장소 루트에서 실행한다. 의존성 설치와 빌드까지 이미지 안에서 하므로 호스트에서 먼저 빌드할 필요가 없다.

```bash
docker build . -f packages/backend/Dockerfile -t devmng
# 또는: yarn build-image (packages/backend 에서 실행되는 같은 명령)
```

## 구조 (멀티스테이지)

| 단계       | 하는 일                                                                                |
| ---------- | -------------------------------------------------------------------------------------- |
| `packages` | 각 패키지의 `package.json`만 남긴다. 소스가 바뀌어도 의존성 설치 캐시가 유지된다       |
| `build`    | 네이티브 모듈 빌드 도구를 설치하고 `yarn install --immutable`, `tsc`, `build:backend`  |
| 최종       | 운영 의존성(`yarn workspaces focus --production`)과 번들, 설정, 카탈로그 정의만 담는다 |

- `node` 사용자(권한이 낮은 계정)로 실행하고, `NODE_ENV=production`으로 동작한다.
- `HEALTHCHECK`가 `/.backstage/health/v1/readiness`를 30초마다 확인한다.
- `.dockerignore`가 `.env`, `*.local.yaml`, `node_modules`를 이미지에서 제외한다. 비밀 값은 이미지에 넣지 않고 실행할 때 환경 변수로 넘긴다.
- 카탈로그 정의(`catalog/`)는 이미지의 `/app/catalog`에 들어 있고, `app-config.production.yaml`이 그 경로를 가리킨다.

## 실행 (Postgres와 함께)

운영 설정은 Postgres를 쓴다. 로컬에서는 컨테이너 두 개로 확인할 수 있다.

```bash
docker network create devmng-net
docker run -d --name devmng-pg --network devmng-net -e POSTGRES_PASSWORD postgres:17-alpine

docker run -d --name devmng --network devmng-net -p 7007:7007 \
  -e POSTGRES_HOST=devmng-pg -e POSTGRES_PORT=5432 -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD \
  -e BOTMNG_URL -e BOTMNG_SERVICE_PASSWORD \
  devmng
```

- `-e NAME`(값 없이)은 현재 셸의 환경 변수를 그대로 넘긴다. 비밀번호가 명령줄이나 `docker inspect`의 명령에 남지 않는다. (`docker inspect`의 환경 변수 목록에는 보일 수 있으니 공유하지 않는다.)
- BotMng가 호스트에서 돌고 있으면 컨테이너에서는 `https://host.docker.internal:<포트>`로 접속한다.
- MCP를 함께 쓰려면 `app-config.mcp.example.yaml`을 읽기 전용으로 마운트하고 `--config`로 추가한다 (`docs/mcp.md` 참고).

## 확인한 것

컨테이너를 실제로 띄워 확인했다 (Postgres 컨테이너와 함께, 운영 중인 BotMng에 연결):
헬스체크 `healthy`, 실행 사용자 `node`, readiness 200, 프론트엔드(`/`) 200, MCP 도구 2개, 카탈로그 프로젝트 3개와 의존 관계, BotMng 상태 `ok`, 토큰 없는 MCP 요청 401, 로그에 토큰·비밀번호 없음, 이미지 안에 `.env`·`*.local.yaml` 없음.

## 배포 전에 해야 할 것 (미확인·미해결)

- **로그인 방식**: 운영 설정(`app-config.production.yaml`)은 개발용 게스트 인증(`guest`)만 있다. Backstage는 운영 모드에서 게스트 로그인을 막으므로 컨테이너에서 화면 로그인이 되는지는 확인하지 않았다. 실제로 배포하려면 GitHub 같은 실제 인증으로 바꿔야 한다.
- **HTTPS와 도메인**: 이미지는 HTTP(7007)만 연다. `baseUrl`은 `http://localhost:7007`이다.
- 이미지를 레지스트리에 올리거나 서버에 배포하는 단계는 만들지 않았다.
