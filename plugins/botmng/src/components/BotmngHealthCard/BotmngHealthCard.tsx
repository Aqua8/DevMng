import {
  InfoCard,
  Progress,
  StatusAborted,
  StatusError,
  StatusOK,
  StatusWarning,
} from '@backstage/core-components';
import { fetchApiRef, useApi } from '@backstage/frontend-plugin-api';
import type { ComponentType, PropsWithChildren } from 'react';
import useAsyncRetry from 'react-use/esm/useAsyncRetry';
import useInterval from 'react-use/esm/useInterval';
import {
  describeStatus,
  HealthResponse,
  parseHealth,
  Tone,
} from '../../status';

const REFRESH_MS = 30_000;

const INDICATORS: Record<Tone, ComponentType<PropsWithChildren<{}>>> = {
  ok: StatusOK,
  warn: StatusWarning,
  error: StatusError,
  muted: StatusAborted,
};

/** 백엔드 플러그인이 대신 조회한 BotMng 상태를 보여 주는 카드. 30초마다 갱신한다. */
export const BotmngHealthCard = () => {
  const { fetch } = useApi(fetchApiRef);

  const { value, error, loading, retry } =
    useAsyncRetry(async (): Promise<HealthResponse> => {
      const res = await fetch('plugin://botmng/health');
      if (!res.ok)
        throw new Error(`상태를 가져오지 못했습니다 (${res.status})`);
      const health = parseHealth(await res.json());
      if (!health) throw new Error('상태 응답 형식이 올바르지 않습니다');
      return health;
    }, [fetch]);
  useInterval(retry, REFRESH_MS);

  // 처음 불러오는 동안에는 새로고침 버튼 없이 진행 표시만 보여 준다
  const refreshing = loading && !value;
  const refresh = (
    <button type="button" onClick={retry}>
      새로고침
    </button>
  );

  let body;
  if (value) {
    const { label, tone } = describeStatus(value.status);
    const Indicator = INDICATORS[tone];
    body = (
      <>
        <Indicator>{label}</Indicator>
        {value.issues.length > 0 && (
          <ul>
            {value.issues.map((issue, i) => (
              <li key={`${i}:${issue}`}>{issue}</li>
            ))}
          </ul>
        )}
        <small>
          확인 시각: {new Date(value.checkedAt).toLocaleString('ko-KR')}
        </small>
      </>
    );
  } else if (error && !loading) {
    const Indicator = INDICATORS.error;
    body = <Indicator>{error.message}</Indicator>;
  } else {
    body = <Progress />;
  }

  return (
    <InfoCard title="BotMng 상태" actions={refreshing ? undefined : refresh}>
      {body}
    </InfoCard>
  );
};
