# botmng 백엔드 플러그인

BotMng의 상태를 DevMng 서버가 대신 조회해 카탈로그 상태 카드에 전달하는 백엔드 플러그인.
BotMng 서비스 계정(`devmng`)으로 토큰을 받아 `GET /api/health`만 읽기 전용으로 호출한다.
비밀번호는 서버에만 있고 브라우저로 나가지 않는다.

## API

`GET /api/botmng/health` (로그인한 사용자만)

```json
{ "status": "ok", "issues": [], "checkedAt": "2026-10-07T00:00:00.000Z" }
```

| status                  | 의미                                       |
| ----------------------- | ------------------------------------------ |
| `ok` / `warn` / `error` | BotMng가 알려 준 상태 (`issues`에 이유)    |
| `unreachable`           | BotMng에 연결할 수 없음 (포털은 정상 동작) |
| `unauthorized`          | 서비스 계정 인증·권한 실패                 |
| `not-configured`        | 연동 설정이 없음                           |

## 동작

- `POST /api/auth/service`로 15분짜리 토큰을 받아 캐시하고 만료 1분 전에 다시 받는다 (BotMng의 로그인 횟수 제한: IP당 분당 10회).
- 상태 조회가 401이면 토큰을 새로 받아 한 번만 다시 시도한다.
- BotMng 응답에서는 `status`와 `issues`만 꺼내고 나머지는 버린다. 오류 원인(주소 등)은 응답에 넣지 않는다.

## 설정

`app-config.yaml`의 `botmng`. 값은 환경 변수로만 받는다 (`.env.example` 참고).

| 키                       | 환경 변수                 | 설명                                                                 |
| ------------------------ | ------------------------- | -------------------------------------------------------------------- |
| `botmng.baseUrl`         | `BOTMNG_URL`              | BotMng 주소                                                          |
| `botmng.servicePassword` | `BOTMNG_SERVICE_PASSWORD` | BotMng 서버 `.env`의 `DEVMNG_PASSWORD`와 같은 값 (`secret`으로 표시) |

## 개발

```bash
yarn workspace @internal/backstage-plugin-botmng-backend test
# 플러그인만 띄우기 (모의 인증)
BOTMNG_URL=... BOTMNG_SERVICE_PASSWORD=... yarn workspace @internal/backstage-plugin-botmng-backend start
curl http://localhost:7007/api/botmng/health
```
