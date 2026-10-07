import {
  InfoCard,
  Progress,
  StatusAborted,
  StatusError,
  StatusOK,
  StatusWarning,
} from '@backstage/core-components';
import { fetchApiRef, useApi } from '@backstage/frontend-plugin-api';
import { useEffect } from 'react';
import useAsyncRetry from 'react-use/esm/useAsyncRetry';
import {
  describeStatus,
  HealthResponse,
  parseHealth,
  Tone,
} from '../../status';

const REFRESH_MS = 30_000;

const Indicator = ({ tone, children }: { tone: Tone; children: string }) => {
  switch (tone) {
    case 'ok':
      return <StatusOK>{children}</StatusOK>;
    case 'warn':
      return <StatusWarning>{children}</StatusWarning>;
    case 'muted':
      return <StatusAborted>{children}</StatusAborted>;
    default:
      return <StatusError>{children}</StatusError>;
  }
};

/** 백엔드 플러그인이 대신 조회한 BotMng 상태를 보여 주는 카드. 30초마다 갱신한다. */
export const BotmngHealthCard = () => {
  const { fetch } = useApi(fetchApiRef);

  const state = useAsyncRetry(async (): Promise<HealthResponse> => {
    const res = await fetch('plugin://botmng/health');
    if (!res.ok) throw new Error(`상태를 가져오지 못했습니다 (${res.status})`);
    const health = parseHealth(await res.json());
    if (!health) throw new Error('상태 응답 형식이 올바르지 않습니다');
    return health;
  }, [fetch]);

  const { retry } = state;
  useEffect(() => {
    const timer = setInterval(retry, REFRESH_MS);
    return () => clearInterval(timer);
  }, [retry]);

  const refresh = (
    <button type="button" onClick={retry}>
      새로고침
    </button>
  );

  if (state.loading && !state.value) {
    return (
      <InfoCard title="BotMng 상태">
        <Progress />
      </InfoCard>
    );
  }

  if (state.error && !state.value) {
    return (
      <InfoCard title="BotMng 상태" actions={refresh}>
        <Indicator tone="error">{state.error.message}</Indicator>
      </InfoCard>
    );
  }

  const health = state.value!;
  const { label, tone } = describeStatus(health.status);
  return (
    <InfoCard title="BotMng 상태" actions={refresh}>
      <Indicator tone={tone}>{label}</Indicator>
      {health.issues.length > 0 && (
        <ul>
          {health.issues.map(issue => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
      <small>
        확인 시각: {new Date(health.checkedAt).toLocaleString('ko-KR')}
      </small>
    </InfoCard>
  );
};
