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
}

export class SchedulerEngine {
    private readonly scheduleLock = new ScheduleLock();
    private readonly taskExecutionContext: TaskExecutionContext;
    private readonly swarmExecutionContext: SwarmExecutionContext;
    private readonly scheduleRepository: ScheduleRepository;
    private readonly scheduleRunRepository: ScheduleRunRepository;
    private readonly pollIntervalMs: number;
    private intervalRef: ReturnType<typeof setInterval> | null = null;
    private unsubscribeRunListener: (() => void) | null = null;

    constructor(deps: SchedulerEngineDependencies) {
        this.taskExecutionContext = deps.taskExecutionContext;
        this.swarmExecutionContext = deps.swarmExecutionContext;
        this.scheduleRepository = deps.scheduleRepository;
        this.scheduleRunRepository = deps.scheduleRunRepository;
        this.pollIntervalMs = deps.pollIntervalMs ?? 15000;
    }

    start(): void {
        if (this.intervalRef) {
            return;
        }

        this.unsubscribeRunListener = runEngine.onLifecycleEvent((event) => {
            if (!event.metadata.scheduleId || typeof event.metadata.scheduleId !== 'string') {
                return;
            }

            const scheduleId = event.metadata.scheduleId;
            const isTerminalState = event.type === 'run.finished' || event.type === 'run.failed' || event.type === 'run.cancelled';
            
            if (!isTerminalState) {
                return;
            }

            this.scheduleRunRepository.updateByRunId(event.runId, {
                status: event.status,
                finishedAt: event.timestamp,
                error: typeof event.error === 'string' ? event.error : null,
            });
            this.scheduleRepository.markRunFinished(scheduleId, event.timestamp);
            
            if (this.scheduleLock.isLocked(scheduleId)) {
                this.scheduleLock.release(scheduleId);
            }
        });

        void this.tick();
        this.intervalRef = setInterval(() => {
            void this.tick();
        }, this.pollIntervalMs);
    }

    stop(): void {
        if (this.intervalRef) {
            clearInterval(this.intervalRef);
            this.intervalRef = null;
        }

        if (this.unsubscribeRunListener) {
            this.unsubscribeRunListener();
            this.unsubscribeRunListener = null;
        }
    }

    async runNow(scheduleId: string): Promise<{ status: number; body: unknown }> {
        const schedule = this.scheduleRepository.getById(scheduleId);
        if (!schedule) {
            return { status: 404, body: { error: 'Schedule not found' } };
        }

        if (!this.scheduleLock.acquire(schedule.id)) {
            return { status: 409, body: { error: 'Schedule is already running' } };
        }

        try {
            await this.executeSchedule(schedule, true);
            return { status: 200, body: { status: 'started', scheduleId } };
        } catch (error) {
            this.scheduleLock.release(schedule.id);
            throw error;
        }
    }

    private async tick(): Promise<void> {
        const now = new Date();
        const enabledSchedules = this.scheduleRepository.listEnabled();
        
        for (const schedule of enabledSchedules) {
            if (this.scheduleLock.isLocked(schedule.id)) {
                continue;
            }

            if (!schedule.nextRunAt) {
                this.scheduleRepository.updateNextRunAt(schedule.id, computeNextRunAt(schedule.cronExpr, now));
                continue;
            }

            if (new Date(schedule.nextRunAt).getTime() <= now.getTime()) {
                if (!this.scheduleLock.acquire(schedule.id)) {
                    continue;
                }
                
                try {
                    await this.executeSchedule(schedule, false);
                } catch (error) {
                    this.scheduleLock.release(schedule.id);
                }
            }
        }
    }

    private async executeSchedule(schedule: PersistedSchedule, manual: boolean): Promise<void> {
        let runId: string | null = null;
        
        try {
            const template = schedule.runTemplate as unknown as ScheduleRunTemplate;
            const startedAt = new Date().toISOString();
            const nextRunAt = manual ? schedule.nextRunAt : computeNextRunAt(schedule.cronExpr, new Date(Date.now() + 60_000));
            const runContext = createRunContext({
                runId: randomUUID(),
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
            runId = runContext.runId;

            this.scheduleRepository.markRunStarted(schedule.id, startedAt, nextRunAt);
            this.scheduleRunRepository.create({
                scheduleId: schedule.id,
                runId: runContext.runId,
                status: 'running',
                startedAt,
            });

            if (template.sourceType === 'swarm' && template.sourceId) {
                await startSwarmExecutionWithOptions(template.sourceId, this.swarmExecutionContext, {
                    runContext,
                    manageRunLifecycle: true,
                });
                return;
            }

            if (template.sourceType === 'task' && template.sourceId) {
                await startTaskExecutionWithOptions(template.sourceId, this.taskExecutionContext, {
                    runContext,
                    manageRunLifecycle: true,
                });
                return;
            }

            runEngine.startRun(runContext);
            runEngine.finishRun(runContext.runId);
        } catch (error: unknown) {
            const finishedAt = new Date().toISOString();
            this.scheduleRepository.markRunFinished(schedule.id, finishedAt);
            if (runId) {
                this.scheduleRunRepository.updateByRunId(runId, {
                    status: 'failed',
                    finishedAt,
                    error: error instanceof Error ? error.message : 'Unknown scheduler error',
                });
            }
            throw error;
        }
    }
}

function computeNextRunAt(cronExpr: string, from: Date): string | null {
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
            matchesCronPart(minuteExpr, cursor.getMinutes(), 0, 59) &&
            matchesCronPart(hourExpr, cursor.getHours(), 0, 23) &&
            matchesCronPart(dayExpr, cursor.getDate(), 1, 31) &&
            matchesCronPart(monthExpr, cursor.getMonth() + 1, 1, 12) &&
            matchesCronPart(weekDayExpr, cursor.getDay(), 0, 6)
        ) {
            return cursor.toISOString();
        }
    }

    return null;
}

function matchesCronPart(expression: string, value: number, min: number, max: number): boolean {
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

export let schedulerEngine: SchedulerEngine | null = null;

export function initializeSchedulerEngine(deps: SchedulerEngineDependencies): SchedulerEngine {
    if (!schedulerEngine) {
        schedulerEngine = new SchedulerEngine(deps);
    }

    return schedulerEngine;
}
