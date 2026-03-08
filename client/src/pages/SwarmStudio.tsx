import { useEffect, useMemo, useState } from 'react';
import { Activity, Bot, Clock3, Database, FolderOpen, Play, Search, SquareTerminal, TimerReset, Waypoints } from 'lucide-react';
import { api } from '../api';
import { useWebSocket } from '../hooks/useWebSocket';
import type {
    MemoryEntry,
    StudioAgent,
    StudioArtifact,
    StudioBootstrap,
    StudioEvent,
    StudioRunDetail,
    StudioSchedule,
} from '../types';

const EMPTY_BOOTSTRAP: StudioBootstrap = {
    overview: {
        activeRunCount: 0,
        totalRunCount: 0,
        eventCount: 0,
        artifactCount: 0,
        scheduleCount: 0,
        memoryCount: 0,
    },
    agents: [],
    runs: [],
    toolCalls: [],
    messages: [],
    events: [],
    artifacts: [],
    schedules: [],
    memory: [],
    tools: [],
};

const graphOrder = ['Orchestrator', 'Planner', 'Researcher', 'Coder', 'Reviewer', 'Tester', 'File Manager'];

export default function SwarmStudio() {
    const [bootstrap, setBootstrap] = useState<StudioBootstrap>(EMPTY_BOOTSTRAP);
    const [activeRunId, setActiveRunId] = useState<string | null>(null);
    const [runDetail, setRunDetail] = useState<StudioRunDetail | null>(null);
    const [goal, setGoal] = useState('Build the AI Swarm Studio MVP with runtime, scheduler, memory, and live visualization.');
    const [memoryQuery, setMemoryQuery] = useState('');
    const [memoryResults, setMemoryResults] = useState<MemoryEntry[]>([]);
    const { studioEvents, connected } = useWebSocket();

    useEffect(() => {
        void loadBootstrap();
    }, []);

    useEffect(() => {
        const latest = studioEvents[studioEvents.length - 1];
        if (!latest) {
            return;
        }

        void loadBootstrap();
        if (activeRunId && latest.runId === activeRunId) {
            void loadRun(activeRunId);
        }
    }, [studioEvents, activeRunId]);

    async function loadBootstrap() {
        const data = await api.getStudioBootstrap();
        setBootstrap(data);

        const preferredRunId = activeRunId ?? data.runs[0]?.id ?? null;
        if (preferredRunId) {
            setActiveRunId(preferredRunId);
            await loadRun(preferredRunId);
        }
    }

    async function loadRun(runId: string) {
        const data = await api.getStudioRun(runId);
        setRunDetail(data);
    }

    async function handleRunStart() {
        const created = await api.createStudioRun(goal);
        setActiveRunId(created.run.id);
        setRunDetail(created);
        await loadBootstrap();
    }

    async function handleCancel(runId: string) {
        const canceled = await api.cancelStudioRun(runId);
        setRunDetail(canceled);
        await loadBootstrap();
    }

    async function handleMemorySearch() {
        if (!memoryQuery.trim()) {
            setMemoryResults([]);
            return;
        }
        setMemoryResults(await api.searchStudioMemory(memoryQuery.trim()));
    }

    const activeRun = runDetail?.run ?? bootstrap.runs[0] ?? null;
    const activeAgents = new Map(bootstrap.agents.map((agent) => [agent.name, agent]));
    const activeEdges = useMemo(() => {
        const recentMessages = (runDetail?.messages ?? bootstrap.messages).slice(0, 8);
        return recentMessages.map((message) => `${message.fromAgent}->${message.toAgent}`);
    }, [bootstrap.messages, runDetail?.messages]);

    return (
        <div className="studio-shell">
            <section className="studio-hero card">
                <div>
                    <div className="studio-kicker">AI Swarm Studio</div>
                    <h1>Lokale Multi-Agent-Orchestrierung mit Live-Trace, Schedules und Projekt-Memory.</h1>
                    <p>
                        Das Studio zeigt aktive Agents, Handoffs, Tool-Aufrufe, Artefakte und den Status eines Runs in einem
                        zusammenhängenden Workspace.
                    </p>
                </div>
                <div className="studio-command card">
                    <label className="label">Projektziel</label>
                    <textarea
                        className="textarea"
                        rows={4}
                        value={goal}
                        onChange={(event) => setGoal(event.target.value)}
                    />
                    <div className="studio-command-row">
                        <button className="btn-primary" onClick={handleRunStart}>
                            <Play size={14} />
                            Run Swarm
                        </button>
                        <span className={`studio-status ${connected ? 'online' : 'offline'}`}>
                            {connected ? 'WebSocket live' : 'WebSocket getrennt'}
                        </span>
                    </div>
                </div>
            </section>

            <section className="studio-stats">
                <MetricCard icon={Activity} label="Active Runs" value={bootstrap.overview.activeRunCount} />
                <MetricCard icon={Waypoints} label="Events" value={bootstrap.overview.eventCount} />
                <MetricCard icon={FolderOpen} label="Artifacts" value={bootstrap.overview.artifactCount} />
                <MetricCard icon={Database} label="Memory Entries" value={bootstrap.overview.memoryCount} />
            </section>

            <section className="studio-grid">
                <div className="studio-column-main">
                    <div className="card studio-panel">
                        <PanelHeader icon={Waypoints} title="Swarm Graph" subtitle="Agenten, Aktivität und Handoffs" />
                        <div className="graph-grid">
                            {graphOrder.map((name) => (
                                <GraphNode
                                    key={name}
                                    agent={activeAgents.get(name) ?? null}
                                    active={activeRun?.agentName === name}
                                    highlightedEdges={activeEdges}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="card studio-panel">
                        <PanelHeader icon={Clock3} title="Live Timeline" subtitle="Prompts, Handoffs, Tools und Abschluss" />
                        <div className="timeline-list">
                            {(runDetail?.events ?? bootstrap.events).map((event) => (
                                <TimelineRow key={event.id} event={event} />
                            ))}
                        </div>
                    </div>

                    <div className="studio-row">
                        <div className="card studio-panel">
                            <PanelHeader icon={FolderOpen} title="Workspace" subtitle="Dateien und Artefakte aus dem Run" />
                            <div className="artifact-list">
                                {(runDetail?.artifacts ?? bootstrap.artifacts).map((artifact) => (
                                    <ArtifactRow key={artifact.id} artifact={artifact} />
                                ))}
                            </div>
                        </div>
                        <div className="card studio-panel">
                            <PanelHeader icon={TimerReset} title="Scheduler" subtitle="Wiederkehrende Maintenance- und Regression-Jobs" />
                            <div className="schedule-list">
                                {bootstrap.schedules.map((schedule) => (
                                    <ScheduleRow key={schedule.id} schedule={schedule} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <aside className="studio-column-side">
                    <div className="card studio-panel">
                        <PanelHeader icon={Bot} title="Run Inspector" subtitle="Aktiver Lauf mit Tools und Agenten-Nachrichten" />
                        {activeRun ? (
                            <>
                                <div className="run-summary">
                                    <div>
                                        <span className="run-label">State</span>
                                        <strong>{activeRun.state}</strong>
                                    </div>
                                    <div>
                                        <span className="run-label">Current Agent</span>
                                        <strong>{activeRun.agentName ?? 'idle'}</strong>
                                    </div>
                                    <div>
                                        <span className="run-label">Model</span>
                                        <strong>{activeRun.model}</strong>
                                    </div>
                                </div>
                                <p className="run-goal">{activeRun.goal}</p>
                                {activeRun.state === 'running' && (
                                    <button className="btn-danger" onClick={() => handleCancel(activeRun.id)}>
                                        Cancel Run
                                    </button>
                                )}
                                <div className="inspector-block">
                                    <div className="inspector-title">Tool Calls</div>
                                    {(runDetail?.toolCalls ?? bootstrap.toolCalls).map((tool) => (
                                        <div key={tool.id} className="tool-row">
                                            <div>
                                                <strong>{tool.toolName}</strong>
                                                <span>{tool.agentName}</span>
                                            </div>
                                            <p>{tool.output}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="inspector-block">
                                    <div className="inspector-title">Agent Messages</div>
                                    {(runDetail?.messages ?? bootstrap.messages).map((message) => (
                                        <div key={message.id} className="message-row">
                                            <div>{message.fromAgent} {'->'} {message.toAgent}</div>
                                            <p>{message.content}</p>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <p className="empty-copy">Noch kein Run gestartet.</p>
                        )}
                    </div>

                    <div className="card studio-panel">
                        <PanelHeader icon={SquareTerminal} title="Tool Registry" subtitle="MVP-Tooling für Code, Shell, Git, Dateien und Tests" />
                        <div className="tool-registry">
                            {bootstrap.tools.map((tool) => (
                                <div key={tool.name} className="tool-chip">
                                    <strong>{tool.name}</strong>
                                    <span>{tool.description}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="card studio-panel">
                        <PanelHeader icon={Search} title="Memory" subtitle="Projektwissen, Entscheidungen und Artefakte durchsuchen" />
                        <div className="memory-search">
                            <input
                                className="input"
                                placeholder="z.B. scheduler, runtime, artifact"
                                value={memoryQuery}
                                onChange={(event) => setMemoryQuery(event.target.value)}
                            />
                            <button className="btn-secondary" onClick={handleMemorySearch}>Search</button>
                        </div>
                        <div className="memory-list">
                            {(memoryResults.length > 0 ? memoryResults : bootstrap.memory).map((entry) => (
                                <MemoryRow key={entry.id} entry={entry} />
                            ))}
                        </div>
                    </div>

                    <div className="card studio-panel">
                        <PanelHeader icon={Activity} title="Runs" subtitle="Letzte Sessions im lokalen Workspace" />
                        <div className="run-list">
                            {bootstrap.runs.map((run) => (
                                <button
                                    key={run.id}
                                    className={`run-list-item ${activeRunId === run.id ? 'selected' : ''}`}
                                    onClick={() => {
                                        setActiveRunId(run.id);
                                        void loadRun(run.id);
                                    }}
                                >
                                    <strong>{run.state}</strong>
                                    <span>{run.goal}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>
            </section>
        </div>
    );
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: number }) {
    return (
        <div className="card metric-card">
            <div>
                <span>{label}</span>
                <strong>{value}</strong>
            </div>
            <Icon size={18} />
        </div>
    );
}

function PanelHeader({ icon: Icon, title, subtitle }: { icon: typeof Activity; title: string; subtitle: string }) {
    return (
        <div className="panel-header">
            <div className="panel-title">
                <Icon size={16} />
                <h2>{title}</h2>
            </div>
            <p>{subtitle}</p>
        </div>
    );
}

function GraphNode({ agent, active, highlightedEdges }: { agent: StudioAgent | null; active: boolean; highlightedEdges: string[] }) {
    const color = agent?.color ?? '#8892a0';
    const edgeHint = highlightedEdges.find((edge) => edge.startsWith(`${agent?.name ?? ''}->`) || edge.endsWith(`->${agent?.name ?? ''}`));

    return (
        <div className={`graph-node ${active ? 'active' : ''}`} style={{ borderColor: active ? color : undefined }}>
            <div className="graph-node-head">
                <span className="graph-node-dot" style={{ backgroundColor: color }} />
                <strong>{agent?.name ?? 'n/a'}</strong>
            </div>
            <span>{agent?.role ?? 'Offline'}</span>
            <small>{agent?.model ?? 'No model assigned'}</small>
            {edgeHint && <em>{edgeHint.replace('->', ' -> ')}</em>}
        </div>
    );
}

function TimelineRow({ event }: { event: StudioEvent }) {
    return (
        <div className="timeline-row">
            <span>{event.type}</span>
            <strong>{event.agentName ?? 'system'}</strong>
            <p>{event.payload}</p>
        </div>
    );
}

function ArtifactRow({ artifact }: { artifact: StudioArtifact }) {
    return (
        <div className="artifact-row">
            <strong>{artifact.name}</strong>
            <span>{artifact.kind}</span>
            <p>{artifact.path}</p>
        </div>
    );
}

function ScheduleRow({ schedule }: { schedule: StudioSchedule }) {
    const statusClass = schedule.status === 'active' ? 'online' : 'offline';

    return (
        <div className="schedule-row">
            <div>
                <strong>{schedule.name}</strong>
                <p>{schedule.jobType} · {schedule.cron}</p>
            </div>
            <span className={`studio-status ${statusClass}`}>{schedule.status}</span>
        </div>
    );
}

function MemoryRow({ entry }: { entry: MemoryEntry }) {
    return (
        <div className="memory-row">
            <span>{entry.kind}</span>
            <strong>{entry.title}</strong>
            <p>{entry.content}</p>
        </div>
    );
}
