export class ScheduleLock {
    private readonly lockedScheduleIds = new Set<string>();

    acquire(scheduleId: string): boolean {
        if (this.lockedScheduleIds.has(scheduleId)) {
            return false;
        }

        this.lockedScheduleIds.add(scheduleId);
        return true;
    }

    release(scheduleId: string): void {
        this.lockedScheduleIds.delete(scheduleId);
    }

    isLocked(scheduleId: string): boolean {
        return this.lockedScheduleIds.has(scheduleId);
    }
}
