import type { Entity } from '@backstage/catalog-model';
import type { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import type { AuthService } from '@backstage/backend-plugin-api';
import type { CatalogService } from '@backstage/plugin-catalog-node';

export interface ProjectView {
  name: string;
  title: string;
  type: string;
  lifecycle: string;
  owner: string;
  description: string;
  tags: string[];
  dependsOn: string[];
}

/** 카탈로그 컴포넌트에서 AI에게 알려 줄 값만 꺼낸다 (주석, 링크 같은 내부 정보는 뺀다). */
export function toProjectView(entity: Entity): ProjectView {
  const spec = (entity.spec ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const strings = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  return {
    name: entity.metadata.name,
    title: entity.metadata.title ?? entity.metadata.name,
    type: str(spec.type),
    lifecycle: str(spec.lifecycle),
    owner: str(spec.owner),
    description: entity.metadata.description ?? '',
    tags: entity.metadata.tags ?? [],
    dependsOn: strings(spec.dependsOn),
  };
}

/**
 * MCP 도구로 노출되는 액션: 카탈로그의 프로젝트(컴포넌트) 목록과 의존 관계 조회.
 * 카탈로그는 이 플러그인이 자기 권한으로 읽는다. MCP 토큰은 카탈로그에 접근하지 못한다.
 */
export function registerProjectsAction(
  actionsRegistry: ActionsRegistryService,
  deps: { catalog: CatalogService; auth: AuthService },
) {
  actionsRegistry.register({
    name: 'list-projects',
    title: '프로젝트 목록 조회',
    description:
      '카탈로그에 등록된 내 개인 프로젝트(컴포넌트)의 목록을 조회한다. 이름, 종류, 생명주기, ' +
      '소유자, 설명, 태그와 의존 관계(dependsOn)를 돌려준다. 읽기 전용이다.',
    attributes: { readOnly: true, destructive: false, idempotent: true },
    schema: {
      input: z => z.object({}),
      output: z =>
        z.object({
          projects: z.array(
            z.object({
              name: z.string(),
              title: z.string(),
              type: z.string(),
              lifecycle: z.string(),
              owner: z.string(),
              description: z.string(),
              tags: z.array(z.string()),
              dependsOn: z.array(z.string()),
            }),
          ),
        }),
    },
    action: async () => {
      const { items } = await deps.catalog.getEntities(
        { filter: { kind: 'component' } },
        { credentials: await deps.auth.getOwnServiceCredentials() },
      );
      return { output: { projects: items.map(toProjectView) } };
    },
  });
}
