import type { Entity } from '@backstage/catalog-model';
import type { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { z } from 'zod/v3';
import { registerProjectsAction, toProjectView } from './projects';

const entity = (over: Partial<Entity> = {}): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'botmng',
    title: 'BotMng',
    description: '로그 관제',
    tags: ['nestjs'],
    annotations: { 'github.com/project-slug': 'Aqua8/BotMng', secret: 'x' },
    links: [{ url: 'https://example.com' }],
  },
  spec: {
    type: 'service',
    lifecycle: 'production',
    owner: 'group:default/personal',
    dependsOn: ['component:default/schedule-alert-bot'],
  },
  ...over,
});

describe('toProjectView', () => {
  it('필요한 값만 꺼내고 주석·링크는 뺀다', () => {
    expect(toProjectView(entity())).toEqual({
      name: 'botmng',
      title: 'BotMng',
      type: 'service',
      lifecycle: 'production',
      owner: 'group:default/personal',
      description: '로그 관제',
      tags: ['nestjs'],
      dependsOn: ['component:default/schedule-alert-bot'],
    });
  });
  it('값이 없으면 빈 값으로 채운다', () => {
    const v = toProjectView(
      entity({ metadata: { name: 'x' }, spec: undefined }),
    );
    expect(v).toEqual({
      name: 'x',
      title: 'x',
      type: '',
      lifecycle: '',
      owner: '',
      description: '',
      tags: [],
      dependsOn: [],
    });
  });
});

describe('list-projects 액션', () => {
  const setup = () => {
    const register = jest.fn();
    const getEntities = jest.fn().mockResolvedValue({ items: [entity()] });
    const getOwnServiceCredentials = jest.fn().mockResolvedValue({
      principal: { type: 'service', subject: 'plugin:botmng' },
    });
    registerProjectsAction({ register } as unknown as ActionsRegistryService, {
      catalog: { getEntities } as never,
      auth: { getOwnServiceCredentials } as never,
    });
    return {
      action: register.mock.calls[0][0],
      getEntities,
      getOwnServiceCredentials,
    };
  };

  it('읽기 전용·비파괴로 등록된다', () => {
    const { action } = setup();
    expect(action.name).toBe('list-projects');
    expect(action.attributes).toEqual({
      readOnly: true,
      destructive: false,
      idempotent: true,
    });
  });

  it('컴포넌트만 조회하고 플러그인 자신의 권한으로 카탈로그를 읽는다', async () => {
    const { action, getEntities, getOwnServiceCredentials } = setup();
    const { output } = await action.action({});
    expect(getEntities.mock.calls[0][0]).toEqual({
      filter: { kind: 'component' },
    });
    expect(getEntities.mock.calls[0][1].credentials).toEqual(
      await getOwnServiceCredentials.mock.results[0].value,
    );
    expect(action.schema.output(z).safeParse(output).success).toBe(true);
    expect(output.projects).toHaveLength(1);
  });
});
