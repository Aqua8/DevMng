# DevMng 포털 이미지 (프론트엔드 + 백엔드). 저장소 루트를 컨텍스트로 빌드한다:
#   docker build . -f packages/backend/Dockerfile -t devmng
# 의존성 설치와 빌드까지 모두 이미지 안에서 하므로 호스트에서 먼저 빌드할 필요가 없다.
# 로컬 실행은 docs/docker.md 참고.

# ---- 1단계: 패키지 목록(skeleton)만 뽑는다. 소스가 바뀌어도 의존성 설치 캐시가 유지되도록 하기 위함 ----
FROM node:24-trixie-slim AS packages

WORKDIR /app
COPY package.json yarn.lock ./
COPY .yarn ./.yarn
COPY .yarnrc.yml backstage.json ./
COPY packages packages
COPY plugins plugins

# package.json 만 남기고 나머지 파일은 지운다
RUN find packages plugins \! -name "package.json" -mindepth 2 -maxdepth 2 -exec rm -rf {} \+

# ---- 2단계: 의존성 설치와 빌드 ----
FROM node:24-trixie-slim AS build

# better-sqlite3 같은 네이티브 모듈을 빌드하는 데 필요한 도구
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends python3 g++ build-essential libsqlite3-dev && \
    rm -rf /var/lib/apt/lists/*

USER node
WORKDIR /app

COPY --from=packages --chown=node:node /app .

RUN --mount=type=cache,target=/home/node/.cache/yarn,sharing=locked,uid=1000,gid=1000 \
    yarn install --immutable

# 소스를 복사하고 백엔드 번들(프론트엔드 포함)을 만든다
COPY --chown=node:node . .
RUN yarn tsc
RUN yarn build:backend

# ---- 3단계: 운영 의존성만 설치 (네이티브 모듈 빌드 도구는 이 단계에만 둔다) ----
FROM node:24-trixie-slim AS deps

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends python3 g++ build-essential libsqlite3-dev && \
    rm -rf /var/lib/apt/lists/*

USER node
WORKDIR /app

ENV NODE_ENV=production

COPY --from=packages --chown=node:node /app/.yarn ./.yarn
COPY --from=packages --chown=node:node /app/.yarnrc.yml /app/backstage.json ./

# 빌드가 만든 skeleton 은 개발 의존성을 뺀 package.json 모음이다. 원본 package.json 으로 설치하면
# @types 같은 개발용 패키지까지 들어와 이미지가 3배로 커진다.
COPY --from=build --chown=node:node /app/yarn.lock /app/package.json /app/packages/backend/dist/skeleton.tar.gz ./
RUN tar xzf skeleton.tar.gz && rm skeleton.tar.gz

RUN --mount=type=cache,target=/home/node/.cache/yarn,sharing=locked,uid=1000,gid=1000 \
    yarn workspaces focus --all --production && rm -rf "$(yarn cache clean)"

# ---- 4단계: 실행 이미지 (컴파일러 없이 운영 의존성과 빌드 결과만) ----
FROM node:24-trixie-slim

# 실행은 권한이 가장 낮은 node 사용자로 한다
USER node
WORKDIR /app

# 운영 모드로 전환
ENV NODE_ENV=production

# 패키지 목록(package.json)과 yarn.lock, 2단계에서 설치한 운영 의존성
COPY --from=build --chown=node:node /app/yarn.lock /app/package.json /app/backstage.json /app/packages/backend/dist/skeleton.tar.gz ./
RUN tar xzf skeleton.tar.gz && rm skeleton.tar.gz
COPY --from=deps --chown=node:node /app/node_modules ./node_modules

# 백엔드 번들, 설정 파일, 카탈로그 정의
COPY --from=build --chown=node:node /app/packages/backend/dist/bundle.tar.gz ./
RUN tar xzf bundle.tar.gz && rm bundle.tar.gz
COPY --chown=node:node app-config*.yaml ./
COPY --chown=node:node catalog ./catalog

EXPOSE 7007

# 백엔드가 요청을 받을 준비가 되었는지 확인한다
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD node -e "fetch('http://localhost:7007/.backstage/health/v1/readiness').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "packages/backend", "--config", "app-config.yaml", "--config", "app-config.production.yaml"]
