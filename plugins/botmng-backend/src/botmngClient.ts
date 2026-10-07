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

  constructor(
    private readonly options: {
      baseUrl: string;
      password: string;
      fetch?: FetchLike;
      now?: () => number;
    },
  ) {}

  private get fetch(): FetchLike {
    return this.options.fetch ?? ((url, init) => fetch(url, init));
  }

  private get now(): number {
    return (this.options.now ?? Date.now)();
  }

  private url(path: string): string {
    return `${this.options.baseUrl.replace(/\/+$/, '')}${path}`;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    try {
      return await this.fetch(this.url(path), {
        ...init,
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
      body: JSON.stringify({ password: this.options.password }),
    });
    if (res.status === 401) {
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
      expiresAt: tokenExpiry(body.accessToken) ?? this.now + FALLBACK_TTL_MS,
    };
    return body.accessToken;
  }

  private async getToken(): Promise<string> {
    if (this.token && this.token.expiresAt - REFRESH_MARGIN_MS > this.now) {
      return this.token.value;
    }
    return this.login();
  }

  /** GET /api/health. 토큰이 거부되면(401) 한 번만 새로 받아 다시 시도한다. */
  async getHealth(): Promise<unknown> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await this.getToken();
      const res = await this.request('/api/health', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 && attempt === 0) {
        this.token = undefined;
        continue;
      }
      if (res.status === 401 || res.status === 403) {
        throw new BotmngError('unauthorized', '상태 조회 권한이 없습니다');
      }
      if (!res.ok) {
        throw new BotmngError('bad-response', `상태 조회 실패 (${res.status})`);
      }
      return res.json();
    }
    throw new BotmngError('unauthorized', '상태 조회 권한이 없습니다');
  }
}
