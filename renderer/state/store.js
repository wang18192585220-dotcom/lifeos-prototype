/**
 * 极简内存状态仓库（S2 T21）。
 *
 * 所有业务数据只来自后端（经 window.lifeos.request），仅缓存在内存，
 * 不写 localStorage。各页面共用同一 store，保证跨页面一致。
 */
import { get } from '../api/client.js';

const cache = {
  goals: null,
  projects: null,
  tasks: null,
};

const listeners = new Set();

function notify() {
  for (const fn of [...listeners]) fn();
}

/** 订阅数据变化，返回取消订阅函数。 */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function fetchList(path) {
  const res = await get(path);
  return Array.isArray(res && res.data) ? res.data : [];
}

/** 同步读缓存（未加载返回空数组；页面应先 load）。 */
export function getGoals() {
  return cache.goals || [];
}

export function getProjects() {
  return cache.projects || [];
}

export function getTasks() {
  return cache.tasks || [];
}

/** 拉取并缓存；失败抛出，缓存保持旧值（便于保留用户输入与错误提示）。 */
export async function loadGoals() {
  cache.goals = await fetchList('/api/v1/goals');
  notify();
  return cache.goals;
}

export async function loadProjects() {
  cache.projects = await fetchList('/api/v1/projects');
  notify();
  return cache.projects;
}

export async function loadTasks() {
  cache.tasks = await fetchList('/api/v1/tasks');
  notify();
  return cache.tasks;
}

/** 失效并重新拉取（= load）。 */
export function invalidateGoals() {
  return loadGoals();
}

export function invalidateProjects() {
  return loadProjects();
}

export function invalidateTasks() {
  return loadTasks();
}

/** 并发刷新全部实体。 */
export async function loadAll() {
  await Promise.all([loadGoals(), loadProjects(), loadTasks()]);
}
