/**
 * 内存状态仓库（S2/S3）。业务数据只来自后端，仅缓存内存，不写 localStorage。
 * 各页面共用同一 store，保证跨页面一致。
 */
import { get } from '../api/client.js';

const cache = {
  goals: null,
  projects: null,
  tasks: null,
  agents: null,
  modelProfiles: null,
  libraries: null,
  sessions: null,
  proposals: null,
};

const listeners = new Set();

function notify() {
  for (const fn of [...listeners]) fn();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function fetchList(path) {
  const res = await get(path);
  return Array.isArray(res && res.data) ? res.data : [];
}

function makeAccessors(name) {
  const cap = name[0].toUpperCase() + name.slice(1);
  return {
    getter: () => cache[name] || [],
    load: async () => {
      cache[name] = await fetchList(`/api/v1/${name}`);
      notify();
      return cache[name];
    },
    invalidate: async () => {
      cache[name] = await fetchList(`/api/v1/${name}`);
      notify();
      return cache[name];
    },
  };
}

const accessors = {};
for (const n of ['goals', 'projects', 'tasks', 'agents', 'modelProfiles', 'libraries', 'sessions', 'proposals']) {
  accessors[n] = makeAccessors(n);
}

export const getGoals = accessors.goals.getter;
export const getProjects = accessors.projects.getter;
export const getTasks = accessors.tasks.getter;
export const getAgents = accessors.agents.getter;
export const getModelProfiles = accessors.modelProfiles.getter;
export const getLibraries = accessors.libraries.getter;
export const getSessions = accessors.sessions.getter;
export const getProposals = accessors.proposals.getter;

export const loadGoals = accessors.goals.load;
export const loadProjects = accessors.projects.load;
export const loadTasks = accessors.tasks.load;
export const loadAgents = accessors.agents.load;
export const loadModelProfiles = accessors.modelProfiles.load;
export const loadLibraries = accessors.libraries.load;
export const loadSessions = accessors.sessions.load;
export const loadProposals = accessors.proposals.load;

export const invalidateGoals = accessors.goals.invalidate;
export const invalidateProjects = accessors.projects.invalidate;
export const invalidateTasks = accessors.tasks.invalidate;
export const invalidateAgents = accessors.agents.invalidate;
export const invalidateModelProfiles = accessors.modelProfiles.invalidate;
export const invalidateLibraries = accessors.libraries.invalidate;
export const invalidateSessions = accessors.sessions.invalidate;
export const invalidateProposals = accessors.proposals.invalidate;

export async function loadAll() {
  await Promise.all([loadGoals(), loadProjects(), loadTasks()]);
}
