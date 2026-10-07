import type { RootConfigService } from '@backstage/backend-plugin-api';

export interface BotmngConfig {
  baseUrl: string;
  password: string;
}

/** 내 컴퓨터(호스트)로 향하는 주소. 컨테이너에서 호스트의 BotMng 로 갈 때 host.docker.internal 을 쓴다 */
const LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '[::1]',
  'host.docker.internal',
]);

/**
 * 서비스 계정 비밀번호가 담긴 요청을 보내는 주소이므로 https 만 허용한다.
 * 내 컴퓨터로 향하는 주소만 http 를 허용한다 (설정 실수로 비밀번호가 평문으로 나가는 것을 막는다).
 */
export function isSafeBaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname))
    );
  } catch {
    return false;
  }
}

/**
 * botmng.baseUrl, botmng.servicePassword 를 읽는다. 둘 중 하나라도 없거나 빈 문자열이거나 주소가 안전하지 않으면 undefined(설정 없음).
 * docker compose 가 비워 둔 환경 변수를 빈 문자열로 넘기는데, getOptionalString 은 빈 문자열을 오류로 보고
 * 예외를 던져 백엔드가 시작하지 못하므로 getOptional 로 읽고 직접 거른다.
 */
export function readBotmngConfig(
  config: RootConfigService,
): BotmngConfig | undefined {
  const baseUrl = config.getOptional('botmng.baseUrl');
  const password = config.getOptional('botmng.servicePassword');
  return typeof baseUrl === 'string' &&
    baseUrl &&
    typeof password === 'string' &&
    password &&
    isSafeBaseUrl(baseUrl)
    ? { baseUrl, password }
    : undefined;
}
