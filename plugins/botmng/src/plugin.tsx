import { createFrontendPlugin } from '@backstage/frontend-plugin-api';
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';

/** 카탈로그 페이지에서 이 값이 'true'인 컴포넌트에만 BotMng 상태 카드를 보여 준다. */
export const BOTMNG_HEALTH_ANNOTATION = 'devmng.dev/botmng-health';

export const botmngHealthCard = EntityCardBlueprint.make({
  name: 'health',
  params: {
    type: 'info',
    filter: entity =>
      entity.metadata.annotations?.[BOTMNG_HEALTH_ANNOTATION] === 'true',
    loader: () =>
      import('./components/BotmngHealthCard').then(m => <m.BotmngHealthCard />),
  },
});

export const botmngPlugin = createFrontendPlugin({
  pluginId: 'botmng',
  extensions: [botmngHealthCard],
});
