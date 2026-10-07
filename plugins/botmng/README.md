# botmng 프론트엔드 플러그인

카탈로그의 BotMng 컴포넌트 페이지에 **BotMng 상태 카드**를 보여 주는 프론트엔드 플러그인.
백엔드 플러그인([`botmng-backend`](../botmng-backend))의 `GET /api/botmng/health`를 호출하며, BotMng에는 직접 접속하지 않는다.

## 동작

- 카탈로그 컴포넌트의 주석 `devmng.dev/botmng-health: 'true'`가 있는 페이지에만 카드가 나타난다 (`catalog/components.yaml`의 `botmng`).
- 상태: 정상 / 주의 / 오류 / 연결 불가 / 인증 실패 / 설정 없음. 문제가 있으면 이유(`issues`)를 목록으로 보여 준다.
- 30초마다 자동으로 갱신하고, "새로고침" 버튼으로 바로 갱신할 수 있다.
- 백엔드 응답이 없거나 형식이 다르면 오류 문구를 보여 주고 페이지의 다른 부분은 정상 동작한다.

## 구성

| 파일 | 역할 |
|---|---|
| `src/plugin.tsx` | 엔티티 카드(`EntityCardBlueprint`) 등록, 주석 필터 |
| `src/components/BotmngHealthCard` | 카드 화면 (조회, 주기 갱신, 새로고침) |
| `src/status.ts` | 상태 → 한국어 이름·색 변환, 응답 모양 확인 (순수 함수) |

## 개발

```bash
yarn workspace @internal/backstage-plugin-botmng test
```

카드는 카탈로그의 엔티티 페이지에 붙으므로 화면 확인은 앱에서 한다.

```bash
BOTMNG_URL=... BOTMNG_SERVICE_PASSWORD=... yarn start   # http://localhost:3000/catalog/default/component/botmng
```
