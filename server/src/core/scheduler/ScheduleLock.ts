interface LockEntry {
    acquiredAt: Date;
    runId: string;
}

export class ScheduleLock {
    private readonly lockedScheduleIds = new Map<string, LockEntry>();
    private readonly defaultTimeoutMs: number;

    constructor(defaultTimeoutMs = 30 * 60 * 1000) {
        this.defaultTimeoutMs = defaultTimeoutMs;
    }

    acquire(scheduleId: string, runId: string): boolean {
        const existing = this.lockedScheduleIds.get(scheduleId);

        if (existing) {
            if (this.isTimedOut(existing)) {
                console.warn(`[ScheduleLock] Force-releasing timed-out lock for schedule ${scheduleId} (run ${existing.runId}, acquired at ${existing.acquiredAt.toISOString()})`);
                this.release(scheduleId);
            } else {
                return false;
            }
        }

        this.lockedScheduleIds.set(scheduleId, {
            acquiredAt: new Date(),
            runId,
        });

        console.log(`[ScheduleLock] Acquired lock for schedule ${scheduleId}, run ${runId}`);
        return true;
    }

    release(scheduleId: string): boolean {
        const entry = this.lockedScheduleIds.get(scheduleId);

        if (!entry) {
            return false;
        }

        this.lockedScheduleIds.delete(scheduleId);
        console.log(`[ScheduleLock] Released lock for schedule ${scheduleId}, run ${entry.runId}`);
        return true;
    }

    isLocked(scheduleId: string): boolean {
        const entry = this.lockedScheduleIds.get(scheduleId);

        if (!entry) {
            return false;
        }

        if (this.isTimedOut(entry)) {
            console.warn(`[ScheduleLock] Schedule ${scheduleId} has timed-out lock (run ${entry.runId})`);
            return false;
        }

        return true;
    }

    getLockInfo(scheduleId: string): { runId: string; acquiredAt: string; elapsedMs: number } | null {
        const entry = this.lockedScheduleIds.get(scheduleId);

        if (!entry) {
            return null;
        }

        return {
            runId: entry.runId,
            acquiredAt: entry.acquiredAt.toISOString(),
            elapsedMs: Date.now() - entry.acquiredAt.getTime(),
        };
    }

    getAllLocked(): Array<{ scheduleId: string; runId: string; acquiredAt: string; elapsedMs: number }> {
        const result: Array<{ scheduleId: string; runId: string; acquiredAt: string; elapsedMs: number }> = [];

        for (const [scheduleId, entry] of this.lockedScheduleIds.entries()) {
            result.push({
                scheduleId,
                runId: entry.runId,
                acquiredAt: entry.acquiredAt.toISOString(),
                elapsedMs: Date.now() - entry.acquiredAt.getTime(),
            });
        }

        return result;
    }

    private isTimedOut(entry: LockEntry): boolean {
        return Date.now() - entry.acquiredAt.getTime() > this.defaultTimeoutMs;
    }
}
