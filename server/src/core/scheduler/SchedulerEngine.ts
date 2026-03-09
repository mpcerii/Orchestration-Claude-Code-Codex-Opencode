import { randomUUID } from 'node:crypto';
import { startTaskExecutionWithOptions } from '../../controllers/taskExecution.js';
import { startSwarmExecutionWithOptions } from '../../controllers/swarmExecution.js';
import { ScheduleRepository, type PersistedSchedule } from '../../db/repositories/ScheduleRepository.js';
import { ScheduleRunRepository } from '../../db/repositories/ScheduleRunRepository.js';
import { runEngine } from '../runtime/RunEngine.js';
import { createRunContext } from '../runtime/RunContext.js';
import type { TaskExecutionContext, SwarmExecutionContext } from '../runtime/ExecutionContexts.js';
import { ScheduleLock } from './ScheduleLock.js';
import type { ScheduleRunTemplate } from './SchedulerTypes.js';

interface SchedulerEngineDependencies {
    taskExecutionContext: TaskExecutionContext;
    swarmExecutionContext: SwarmExecutionContext;
    scheduleRepository: ScheduleRepository;
    scheduleRunRepository: ScheduleRunRepository;
    pollIntervalMs?: number;
    lockTimeoutMs?: number;
}

type RunResult =
    | { success: true; runId: string }
    | { success: false; error: string; runId?: string };

export class SchedulerEngine {
    private readonly scheduleLock: ScheduleLock;
    private readonly taskExecutionContext: TaskExecutionContext;
    private readonly swarmExecutionContext: SwarmExecutionContext;
    private readonly scheduleRepository: ScheduleRepository;
    private readonly scheduleRunRepository: ScheduleRunRepository;
    private readonly pollIntervalMs: number;
    private intervalRef: ReturnType<typeof setInterval> | null = null;
    private unsubscribeRunListener: (() => void) | null = null;
    private isRunning = false;

    constructor(deps: SchedulerEngineDependencies) {
        this.taskExecutionContext = deps.taskExecutionContext;
        this.swarmExecutionContext = deps.swarmExecutionContext;
        this.scheduleRepository = deps.scheduleRepository;
        this.scheduleRunRepository = deps.scheduleRunRepository;
        this.pollIntervalMs = deps.pollIntervalMs ?? 15000;
        this.scheduleLock = new ScheduleLock(deps.lockTimeoutMs ?? 30 * 60 * 1000);
    }

    start(): void {
        if (this.intervalRef) {
            console.log('[SchedulerEngine] Already running, ignoring start() call');
            return;
        }

        console.log('[SchedulerEngine] Starting scheduler engine...');

        this.unsubscribeRunListener = runEngine.onLifecycleEvent((event) => {
            if (!event.metadata.scheduleId || typeof event.metadata.scheduleId !== 'string') {
                return;
            }

            const scheduleId = event.metadata.scheduleId;
            const isTerminalState = event.type === 'run.finished' || event.type === 'run.failed' || event.type === 'run.cancelled';

            if (!isTerminalState) {
                return;
            }

            console.log(`[SchedulerEngine] Run ${event.runId} reached terminal state: ${event.type}`);

            this.scheduleRunRepository.updateByRunId(event.runId, {
                status: event.status,
                finishedAt: event.timestamp,
                error: typeof event.error === 'string' ? event.error : null,
            });

            this.scheduleRepository.markRunFinished(scheduleId, event.timestamp);

            const wasLocked = this.scheduleLock.isLocked(scheduleId);
            if (wasLocked) {
                const released = this.scheduleLock.release(scheduleId);
                if (released) {
                    console.log(`[SchedulerEngine] Released lock for schedule ${scheduleId} after ${event.type}`);
                }
            }
        });

        void this.tick();
        this.intervalRef = setInterval(() => {
            void this.tick();
        }, this.pollIntervalMs);

        console.log(`[SchedulerEngine] Scheduler started with poll interval ${this.pollIntervalMs}ms`);
    }

    stop(): void {
        console.log('[SchedulerEngine] Stopping scheduler engine...');

        if (this.intervalRef) {
            clearInterval(this.intervalRef);
            this.intervalRef = null;
        }

        if (this.unsubscribeRunListener) {
            this.unsubscribeRunListener();
            this.unsubscribeRunListener = null;
        }

        this.isRunning = false;

        const locked = this.scheduleLock.getAllLocked();
        if (locked.length > 0) {
            console.warn(`[SchedulerEngine] Warning: ${locked.length} schedule(s) still locked at stop:`, locked.map(l => l.scheduleId));
        }

        console.log('[SchedulerEngine] Scheduler stopped');
    }

    async runNow(scheduleId: string): Promise<{ status: number; body: unknown }> {
        const schedule = this.scheduleRepository.getById(scheduleId);
        if (!schedule) {
            return { status: 404, body: { error: 'Schedule not found' } };
        }

        if (!schedule.enabled) {
            return { status: 409, body: { error: 'Schedule is disabled' } };
        }

        const lockInfo = this.scheduleLock.getLockInfo(schedule.id);
        if (lockInfo) {
            return {
                status: 409,
                body: {
                    error: 'Schedule is already running',
                    runId: lockInfo.runId,
                    startedAt: lockInfo.acquiredAt,
                    elapsedMs: lockInfo.elapsedMs,
                }
            };
        }

        const runId = randomUUID();

        if (!this.scheduleLock.acquire(schedule.id, runId)) {
            return { status: 409, body: { error: 'Schedule is already running (lock acquisition failed)' } };
        }

        console.log(`[SchedulerEngine] Manual run triggered for schedule ${scheduleId}, run ${runId}`);

        const scheduleIdForCleanup = schedule.id;

        try {
            const result = await this.executeSchedule(schedule, runId, true);

            if (result.success) {
                return {
                    status: 200,
                    body: {
                        status: 'started',
                        scheduleId,
                        runId: result.runId,
                    }
                };
            } else {
                this.scheduleLock.release(scheduleIdForCleanup);
                return {
                    status: 500,
                    body: {
                        error: result.error,
                        scheduleId,
                    }
                };
            }
        } catch (error) {
            console.error(`[SchedulerEngine] Unexpected error in runNow for schedule ${scheduleId}:`, error);
            this.scheduleLock.release(scheduleIdForCleanup);
            throw error;
        }
    }

    private async tick(): Promise<void> {
        if (this.isRunning) {
            console.log('[SchedulerEngine] Tick skipped: previous tick still running');
            return;
        }

        this.isRunning = true;

        try {
            const now = new Date();
            const enabledSchedules = this.scheduleRepository.listEnabled();

            console.log(`[SchedulerEngine] Tick: checking ${enabledSchedules.length} enabled schedules at ${now.toISOString()}`);

            for (const schedule of enabledSchedules) {
                if (this.scheduleLock.isLocked(schedule.id)) {
                    const lockInfo = this.scheduleLock.getLockInfo(schedule.id);
                    console.log(`[SchedulerEngine] Skipping schedule ${schedule.id}: already running (run ${lockInfo?.runId}, elapsed ${lockInfo?.elapsedMs}ms)`);
                    continue;
                }

                const nextRunAt = this.computeOrUpdateNextRunAt(schedule, now);

                if (!nextRunAt) {
                    console.warn(`[SchedulerEngine] Schedule ${schedule.id} has invalid cron expression: ${schedule.cronExpr}`);
                    continue;
                }

                if (nextRunAt.getTime() <= now.getTime()) {
                    const runId = randomUUID();

                    if (!this.scheduleLock.acquire(schedule.id, runId)) {
                        console.log(`[SchedulerEngine] Failed to acquire lock for schedule ${schedule.id}`);
                        continue;
                    }

                    console.log(`[SchedulerEngine] Auto-triggering schedule ${schedule.id}, run ${runId} (nextRunAt ${nextRunAt.toISOString()} <= now ${now.toISOString()})`);

                    const scheduleId = schedule.id;
                    
                    try {
                        const result = await this.executeSchedule(schedule, runId, false);

                        if (!result.success) {
                            console.error(`[SchedulerEngine] Auto-trigger failed for schedule ${scheduleId}:`, result.error);
                            this.scheduleLock.release(scheduleId);
                        }
                    } catch (error) {
                        console.error(`[SchedulerEngine] Unexpected error in tick for schedule ${schedule.id}:`, error);
                        this.scheduleLock.release(scheduleId);
                    }
                }
            }
        } finally {
            this.isRunning = false;
        }
    }

    private computeOrUpdateNextRunAt(schedule: PersistedSchedule, now: Date): Date | null {
        if (!schedule.nextRunAt) {
            const computed = this.computeNextRunAt(schedule.cronExpr, now);
            if (computed) {
                this.scheduleRepository.updateNextRunAt(schedule.id, computed);
            }
            return computed ? new Date(computed) : null;
        }

        return new Date(schedule.nextRunAt);
    }

    private async executeSchedule(schedule: PersistedSchedule, runId: string, manual: boolean): Promise<RunResult> {
        const startedAt = new Date().toISOString();
        const scheduleId = schedule.id;

        try {
            const template = schedule.runTemplate as unknown as ScheduleRunTemplate;

            const nextRunAt = this.computeNextRunAt(schedule.cronExpr, new Date(Date.now() + 60_000));

            const runContext = createRunContext({
                runId,
                runType: template.sourceType ?? 'task',
                sourceId: template.sourceId ?? schedule.id,
                rootGoal: template.goal || schedule.name,
                metadata: {
                    kind: 'schedule',
                    scheduleId: schedule.id,
                    jobType: template.jobType,
                    manual,
                    sourceType: template.sourceType ?? null,
                    sourceId: template.sourceId ?? null,
                },
            });

            this.scheduleRepository.markRunStarted(scheduleId, startedAt, nextRunAt);
            this.scheduleRunRepository.create({
                scheduleId,
                runId: runContext.runId,
                status: 'running',
                startedAt,
            });

            console.log(`[SchedulerEngine] Starting ${manual ? 'manual' : 'auto'} execution for schedule ${scheduleId}, run ${runId}`);

            if (template.sourceType === 'swarm' && template.sourceId) {
                await startSwarmExecutionWithOptions(template.sourceId, this.swarmExecutionContext, {
                    runContext,
                    manageRunLifecycle: true,
                });
            } else if (template.sourceType === 'task' && template.sourceId) {
                await startTaskExecutionWithOptions(template.sourceId, this.taskExecutionContext, {
                    runContext,
                    manageRunLifecycle: true,
                });
            } else {
                runEngine.startRun(runContext);
                runEngine.finishRun(runContext.runId);
            }

            return { success: true, runId };
        } catch (error: unknown) {
            const finishedAt = new Date().toISOString();
            const errorMessage = error instanceof Error ? error.message : 'Unknown scheduler error';

            console.error(`[SchedulerEngine] Execution failed for schedule ${scheduleId}, run ${runId}:`, error);

            this.scheduleRepository.markRunFinished(scheduleId, finishedAt);
            if (runId) {
                this.scheduleRunRepository.complete(runId, finishedAt, 'failed', errorMessage);
            }

            return { success: false, error: errorMessage, runId };
        }
    }

    private computeNextRunAt(cronExpr: string, from: Date): string | null {
        const parts = cronExpr.trim().split(/\s+/);
        if (parts.length !== 5) {
            return null;
        }

        const [minuteExpr, hourExpr, dayExpr, monthExpr, weekDayExpr] = parts;
        const cursor = new Date(from.getTime());
        cursor.setSeconds(0, 0);

        for (let index = 0; index < 525600; index += 1) {
            cursor.setMinutes(cursor.getMinutes() + 1);
            if (
                this.matchesCronPart(minuteExpr, cursor.getMinutes(), 0, 59) &&
                this.matchesCronPart(hourExpr, cursor.getHours(), 0, 23) &&
                this.matchesCronPart(dayExpr, cursor.getDate(), 1, 31) &&
                this.matchesCronPart(monthExpr, cursor.getMonth() + 1, 1, 12) &&
                this.matchesCronPart(weekDayExpr, cursor.getDay(), 0, 6)
            ) {
                return cursor.toISOString();
            }
        }

        return null;
    }

    private matchesCronPart(expression: string, value: number, min: number, max: number): boolean {
        if (expression === '*') {
            return true;
        }

        return expression.split(',').some((segment) => {
            if (segment.startsWith('*/')) {
                const step = Number(segment.slice(2));
                return Number.isFinite(step) && step > 0 && (value - min) % step === 0;
            }

            const parsed = Number(segment);
            return Number.isFinite(parsed) && parsed >= min && parsed <= max && parsed === value;
        });
    }
}

export let schedulerEngine: SchedulerEngine | null = null;

export function initializeSchedulerEngine(deps: SchedulerEngineDependencies): SchedulerEngine {
    if (!schedulerEngine) {
        schedulerEngine = new SchedulerEngine(deps);
    }

    return schedulerEngine;
}
