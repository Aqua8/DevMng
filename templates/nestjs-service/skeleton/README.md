# ${{ values.name }}

${{ values.description }}

DevMng의 "NestJS 서비스" 템플릿으로 만든 뼈대입니다. NestJS 11, TypeScript, Jest로 구성했고 `GET /health`가 있습니다.

## 실행

```bash
npm ci
npm test
npm run build && npm start     # http://127.0.0.1:3000/health
```

- 기본은 `127.0.0.1`에서만 접속됩니다. 바꾸려면 `HOST`, `PORT` 환경 변수를 씁니다 (`.env.example` 참고).
- 의존성은 `package-lock.json`으로 고정되어 있습니다. 의존성을 바꾼 뒤에는 `npm install`로 잠금 파일을 갱신하고 함께 커밋하세요.

## Docker

```bash
docker build . -t ${{ values.name }}
docker run --rm -p 127.0.0.1:3000:3000 ${{ values.name }}
```

멀티스테이지로 빌드하고 `node` 사용자로 실행하며 `HEALTHCHECK`가 `/health`를 확인합니다.

## CI

`.github/workflows/ci.yml`: 읽기 권한만 부여, 액션은 커밋 해시로 고정, `npm ci` → 운영 의존성 취약점 점검(`npm audit --omit=dev`, 높음 이상이면 실패) → 테스트 → 빌드, Docker 이미지 빌드.

## 이 뼈대에 없는 것

인증, 데이터베이스, 설정 검증, 로깅 설정, 배포는 포함하지 않았습니다. 서비스에 맞게 직접 추가합니다.
