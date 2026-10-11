import type { ScheduledTask } from '../types';

export const MAX_TASKS = 20;
export const TASK_STALE_MS = 10 * 60_000;
export const TASK_RUN_MS = 5 * 60_000;
const formats = new Map<string, Intl.DateTimeFormat>();
const times = new Map<string, number>();
function formatter(zone: string) {
  if (!formats.has(zone)) formats.set(zone, new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }));
  return formats.get(zone)!;
}
function parts(at: number, zone: string) {
  return Object.fromEntries(formatter(zone).formatToParts(at).map(part => [part.type, part.value]));
}
function wall(at: number, zone: string) {
  const p = parts(at, zone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
function previousDate(date: string) { return new Date(Date.parse(`${date}T12:00:00Z`) - 86_400_000).toISOString().slice(0,10); }

/** First occurrence in a repeated DST hour; first valid minute after a skipped wall time. */
export function zonedTime(date: string, time: string, zone: string): number {
  const key = `${date}T${time}@${zone}`;
  if (times.has(key)) return times.get(key)!;
  const target = Date.parse(`${date}T${time}:00Z`), desired = `${date}T${time}`;
  const candidates = [...new Set([-36,0,36].map(hours => {
    const at = target + hours * 3_600_000, p = parts(at,zone);
    const offset = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`) - at;
    return target - offset;
  }))].sort((a,b)=>a-b);
  const exact = candidates.filter(at=>wall(at,zone)===desired);
  let result = exact[0];
  if (result === undefined) {
    for (let at = candidates[0]; at <= candidates.at(-1)!; at += 60_000) {
      if (wall(at,zone)>=desired) { result = at; break; }
    }
  }
  if (!Number.isFinite(result)) throw new Error('This schedule cannot be represented in that time zone.');
  if (times.size > 200) times.clear();
  times.set(key,result); return result;
}

export function normalizeTask(raw: any): ScheduledTask | null {
  if (!raw || typeof raw.id!=='string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(raw.id) || typeof raw.name !== 'string' || !raw.name.trim() || typeof raw.prompt !== 'string' || !raw.prompt.trim()) return null;
  if (!['reminder','assistant'].includes(raw.kind) || !Number.isFinite(raw.createdAt) || !Number.isFinite(raw.updatedAt)) return null;
  let schedule: ScheduledTask['schedule'];
  if (raw.schedule?.kind === 'once' && Number.isFinite(raw.schedule.at) && raw.schedule.at >= Date.UTC(2000,0,1) && raw.schedule.at < Date.UTC(2100,0,1)) schedule = { kind:'once', at:raw.schedule.at };
  else if (raw.schedule?.kind === 'daily' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(raw.schedule.time) && typeof raw.schedule.timeZone === 'string' && raw.schedule.timeZone.length < 100) {
    try { formatter(raw.schedule.timeZone); } catch { return null; }
    schedule = { kind:'daily', time:raw.schedule.time, timeZone:raw.schedule.timeZone };
  } else return null;
  const run = raw.lastRun;
  const lastRun = run && typeof run.key==='string' && typeof run.token==='string' && Number.isFinite(run.at) && ['running','done','error','review','interrupted'].includes(run.status)
    ? { key:run.key.slice(0,250), token:run.token.slice(0,100), at:run.at, status:run.status, ...(typeof run.chatId==='string' ? {chatId:run.chatId.slice(0,100)} : {}), ...(typeof run.error==='string' ? {error:run.error.slice(0,1000)} : {}) } : undefined;
  return { id:raw.id, name:raw.name.trim().slice(0,60), prompt:raw.prompt.trim().slice(0,8000), kind:raw.kind, model:typeof raw.model==='string' ? raw.model.slice(0,200) : 'auto', search:raw.kind==='assistant' && Boolean(raw.search), enabled:Boolean(raw.enabled), schedule, createdAt:raw.createdAt, updatedAt:raw.updatedAt, ...(typeof raw.lastOccurrence==='string' ? { lastOccurrence:raw.lastOccurrence.slice(0,250) } : {}), ...(lastRun ? {lastRun} : {}) };
}
export function normalizeTasks(raw: unknown): ScheduledTask[] {
  if (!Array.isArray(raw)) return [];
  return [...new Map(raw.map(normalizeTask).filter((task): task is ScheduledTask=>Boolean(task)).map(task=>[task.id,task])).values()].slice(0,MAX_TASKS).sort((a,b)=>b.createdAt-a.createdAt);
}

/** Only the latest missed daily occurrence runs, never a backlog of every missed day. */
export function taskOccurrence(task: ScheduledTask, now = Date.now()): { key: string; at: number } | null {
  if (!task.enabled) return null;
  if (task.schedule.kind==='once') return task.schedule.at<=now ? { key:`once:${task.schedule.at}`, at:task.schedule.at } : null;
  const {time,timeZone} = task.schedule;
  let date = wall(now,timeZone).slice(0,10);
  let at = zonedTime(date,time,timeZone);
  if (at > now) { date=previousDate(date); at=zonedTime(date,time,timeZone); }
  return at >= task.createdAt ? { key:`daily:${date}:${time}@${timeZone}`, at } : null;
}
export function taskDue(task: ScheduledTask, now = Date.now()) {
  const occurrence = taskOccurrence(task,now);
  return occurrence && occurrence.key!==task.lastOccurrence ? occurrence : null;
}
export function scheduleLabel(task: ScheduledTask): string {
  return task.schedule.kind==='once' ? new Date(task.schedule.at).toLocaleString() : `Daily · ${task.schedule.time} · ${task.schedule.timeZone.replaceAll('_',' ')}`;
}
