/** BotMng 서비스 계정으로 토큰을 받아 캐시하고 /api/health 만 읽기 전용으로 호출한다. */

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export class BotmngError extends Error {
  constructor(
    readonly kind: 'unauthorized' | 'unreachable' | 'bad-response',
    message: string,
  ) {
    super(message);
  }
}

const REQUEST_TIMEOUT_MS = 5_000;
const REFRESH_MARGIN_MS = 60_000; // 만료 1분 전부터는 새 토큰을 받는다
const LOGIN_RETRY_MS = 60_000; // 인증 실패 뒤에는 이 시간 동안 다시 로그인하지 않는다 (틀린 비밀번호를 계속 보내지 않도록)
const FALLBACK_TTL_MS = 10 * 60_000; // 토큰에서 만료 시각을 읽지 못하면 BotMng의 15분보다 짧게 가정

/** JWT 본문의 exp(초)를 읽어 만료 시각(ms)을 돌려준다. 읽지 못하면 undefined. 서명은 검증하지 않는다(BotMng가 검증). */
export function tokenExpiry(token: string): number | undefined {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    );
    return typeof payload.exp === 'number' ? payload.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}

export class BotmngClient {
  private token?: { value: string; expiresAt: number };
  /** 인증 실패를 기억한다. 틀린 비밀번호로 요청마다 로그인을 반복해 BotMng 가 계정을 잠그는 일을 막는다 */
  private loginFailure?: { error: BotmngError; until: number };
  /** 진행 중인 로그인. 동시 요청이 와도 로그인은 한 번만 한다 */
  private loginInFlight?: Promise<string>;
  private readonly baseUrl: string;
  private readonly password: string;
  private readonly fetchFn: FetchLike;
  private readonly now: () => number;

  constructor(options: {
    baseUrl: string;
    password: string;
    fetch?: FetchLike;
    now?: () => number;
  }) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.password = options.password;
    this.fetchFn = options.fetch ?? ((url, init) => fetch(url, init));
    this.now = options.now ?? Date.now;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    try {
      return await this.fetchFn(`${this.baseUrl}${path}`, {
        ...init,
        // 리다이렉트를 따라가지 않는다. 주소 설정이 잘못되어도 비밀번호가 담긴 요청이 다른 곳으로 재전송되지 않게 한다
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      // 연결 거부·시간 초과·인증서 오류 등. 원인 메시지에는 주소가 섞일 수 있어 종류만 알린다.
      throw new BotmngError('unreachable', 'BotMng에 연결할 수 없습니다');
    }
  }

  private async login(): Promise<string> {
    const res = await this.request('/api/auth/service', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: this.password }),
    });
    if (res.status === 401 || res.status === 403) {
      throw new BotmngError('unauthorized', '서비스 계정 인증에 실패했습니다');
    }
    if (!res.ok) {
      throw new BotmngError('bad-response', `토큰 발급 실패 (${res.status})`);
    }
    const body = (await res.json()) as { accessToken?: unknown };
    if (typeof body.accessToken !== 'string') {
      throw new BotmngError(
        'bad-response',
        '토큰 응답 형식이 올바르지 않습니다',
      );
    }
    this.token = {
      value: body.accessToken,
      expiresAt: tokenExpiry(body.accessToken) ?? this.now() + FALLBACK_TTL_MS,
    };
    return body.accessToken;
  }

  private getToken(): Promise<string> {
    if (this.token && this.token.expiresAt - REFRESH_MARGIN_MS > this.now()) {
      return Promise.resolve(this.token.value);
    }
    if (this.loginFailure && this.loginFailure.until > this.now()) {
      return Promise.reject(this.loginFailure.error);
    }
    this.loginInFlight ??= this.login()
      .then(token => {
        this.loginFailure = undefined;
        return token;
      })
      .catch(err => {
        if (err instanceof BotmngError && err.kind === 'unauthorized') {
          this.loginFailure = {
            error: err,
            until: this.now() + LOGIN_RETRY_MS,
          };
        }
        throw err;
      })
      .finally(() => {
        this.loginInFlight = undefined;
      });
    return this.loginInFlight;
  }

  private requestHealth(token: string): Promise<Response> {
    return this.request('/api/health', {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  /** GET /api/health. 토큰이 거부되면(401) 한 번만 새로 받아 다시 시도한다. */
  async getHealth(): Promise<unknown> {
    const token = await this.getToken();
    let res = await this.requestHealth(token);
    if (res.status === 401) {
      // 그 사이 다른 요청이 이미 새 토큰을 받았다면 그 토큰은 지우지 않는다
      if (this.token?.value === token) this.token = undefined;
      res = await this.requestHealth(await this.getToken());
    }
    if (res.status === 401 || res.status === 403) {
      throw new BotmngError('unauthorized', '상태 조회 권한이 없습니다');
    }
    if (!res.ok) {
      throw new BotmngError('bad-response', `상태 조회 실패 (${res.status})`);
    }
    return res.json();
  }
}
