export class RuntimeState {
    private readonly runningTasks = new Set<string>();
    private readonly runningSwarms = new Set<string>();

    isTaskRunning(taskId: string): boolean {
        return this.runningTasks.has(taskId);
    }

    startTask(taskId: string): void {
        this.runningTasks.add(taskId);
    }

    finishTask(taskId: string): void {
        this.runningTasks.delete(taskId);
    }

    isSwarmRunning(swarmId: string): boolean {
        return this.runningSwarms.has(swarmId);
    }

    startSwarm(swarmId: string): void {
        this.runningSwarms.add(swarmId);
    }

    finishSwarm(swarmId: string): void {
        this.runningSwarms.delete(swarmId);
    }
}
