export type RunType = 'task' | 'swarm';

export type RunLifecycleStatus =
    | 'created'
    | 'running'
    | 'completed'
    | 'failed'
    | 'cancelled';
