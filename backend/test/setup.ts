import { vi } from 'vitest';

const mockRoleRepo = { findOne: vi.fn().mockResolvedValue({ id: 2, name: 'user' }) };
const mockRepoStorage: Record<string, Record<string, unknown>> = {};

function makeMockRepo(entity: string) {
  return mockRepoStorage[entity] ?? {};
}

vi.mock('../src/services/dataSource', () => ({
  AppDataSource: {
    getRepository: vi.fn((entity: string) => makeMockRepo(entity)),
  },
}));

function resetRepos(repos: Record<string, Record<string, unknown>> = {}) {
  Object.keys(mockRepoStorage).forEach((k) => delete mockRepoStorage[k]);
  Object.assign(mockRepoStorage, repos);
}

vi.mocked(vi.fn()).mockImplementation(() => makeMockRepo(''));

export { mockRoleRepo, mockRepoStorage, resetRepos };