import { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import { useWebSocket } from '../hooks/useWebSocket';
import type { Agent, Swarm, SwarmAgent, WsMessage } from '../types';
import {
    Plus, Trash2, Edit3, Save, X, Network, Play, Square,
    ChevronDown, ChevronRight, User, Bot,
} from 'lucide-react';

const SWARM_ROLES = [
    { value: 'coordinator', label: 'Coordinator', color: '#f59e0b' },
    { value: 'analyzer', label: 'Analyzer', color: '#6366f1' },
    { value: 'developer', label: 'Developer', color: '#22c55e' },
    { value: 'reviewer', label: 'Reviewer', color: '#3b82f6' },
    { value: 'tester', label: 'Tester', color: '#ef4444' },
] as const;

const DEFAULT_SWARM: Partial<Swarm> = {
    name: '',
    description: '',
    agents: [],
    workspacePath: '',
    minRounds: 3,
    maxRounds: 20,
    status: 'idle',
    rounds: [],
    currentRound: 0,
};

export default function AgentSwarm() {
    const [swarms, setSwarms] = useState<Swarm[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [editing, setEditing] = useState<Partial<Swarm> | null>(null);
    const [activeSwarm, setActiveSwarm] = useState<string | null>(null);
    const [executing, setExecuting] = useState(false);
    const { messages } = useWebSocket();
    const outputRef = useRef<HTMLDivElement>(null);

    useEffect(() => { loadData(); }, []);

    // Auto-scroll output
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [messages]);

    async function loadData() {
        const [s, a] = await Promise.all([api.getSwarms(), api.getAgents()]);
        setSwarms(s);
        setAgents(a);
    }

    function startNew() {
        setEditing({ ...DEFAULT_SWARM, agents: [] });
    }

    function startEdit(swarm: Swarm) {
        setEditing({ ...swarm, agents: [...swarm.agents] });
    }

    async function handleSave() {
        if (!editing?.name || !editing.agents?.length) return;
        if (editing.id) {
            await api.updateSwarm(editing.id, editing);
        } else {
            await api.createSwarm(editing);
        }
        setEditing(null);
        loadData();
    }

    async function handleDelete(id: string) {
        await api.deleteSwarm(id);
        if (activeSwarm === id) setActiveSwarm(null);
        loadData();
    }

    async function handleExecute(id: string) {
        if (executing) return;
        setExecuting(true);
        setActiveSwarm(id);
        try {
            await api.executeSwarm(id);
            loadData();
        } catch (err) {
            console.error('Swarm execute failed:', err);
        } finally {
            setExecuting(false);
        }
    }

    async function handleStop(id: string) {
        try {
            await api.stopSwarm(id);
            loadData();
        } catch (err) {
            console.error('Swarm stop failed:', err);
        }
    }

    function addAgentToSwarm(agentId: string) {
        if (!editing) return;
        const existing = editing.agents || [];
        const isFirst = existing.length === 0;
        setEditing({
            ...editing,
            agents: [
                ...existing,
                {
                    id: crypto.randomUUID(),
                    agentId,
                    role: isFirst ? 'coordinator' : 'developer',
                    instructions: '',
                } as SwarmAgent,
            ],
        });
    }

    function removeAgentFromSwarm(slotId: string) {
        if (!editing) return;
        setEditing({
            ...editing,
            agents: (editing.agents || []).filter((a) => a.id !== slotId),
        });
    }

    function updateSwarmAgent(slotId: string, updates: Partial<SwarmAgent>) {
        if (!editing) return;
        setEditing({
            ...editing,
            agents: (editing.agents || []).map((a) =>
                a.id === slotId ? { ...a, ...updates } : a
            ),
        });
    }

    function getAgentName(agentId: string) {
        return agents.find((a) => a.id === agentId)?.name || 'Unknown';
    }

    function getAgentColor(agentId: string) {
        return agents.find((a) => a.id === agentId)?.color || '#6366f1';
    }

    // Filter WS messages for active swarm
    const swarmMessages = messages.filter(
        (m) => m.taskId === activeSwarm &&
            ['swarm_round', 'swarm_complete', 'swarm_error', 'swarm_status', 'agent_start', 'agent_output', 'agent_complete', 'agent_error'].includes(m.type)
    );

    const activeSwarmData = swarms.find((s) => s.id === activeSwarm);

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em' }}>Agent Swarm</h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 14 }}>
                        Autonome Multi-Agent Kollaboration - Agents arbeiten selbststaendig zusammen
                    </p>
                </div>
                <button className="btn-primary" onClick={startNew}>
                    <Plus size={16} /> Neuer Swarm
                </button>
            </div>

            {/* Editor Modal */}
            {editing && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
                }}>
                    <div className="card" style={{ width: 640, maxHeight: '85vh', padding: 28, overflow: 'auto', animation: 'fadeIn 0.2s ease-out' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                                {editing.id ? 'Swarm bearbeiten' : 'Neuer Swarm'}
                            </h2>
                            <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {/* Name */}
                            <div>
                                <label className="label">Name</label>
                                <input className="input" placeholder="z.B. Bug Hunter Swarm"
                                    value={editing.name || ''}
                                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="label">Beschreibung / Ziel</label>
                                <textarea className="textarea" rows={3}
                                    placeholder="Was soll der Swarm erreichen? z.B. 'Analysiere das Projekt, finde Bugs, verbessere Code-Qualitaet'"
                                    value={editing.description || ''}
                                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                                />
                            </div>

                            {/* Workspace + Max Rounds */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                                <div>
                                    <label className="label">Workspace Pfad</label>
                                    <input className="input"
                                        placeholder="C:\Users\...\mein-projekt"
                                        value={editing.workspacePath || ''}
                                        onChange={(e) => setEditing({ ...editing, workspacePath: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="label">Min Runden</label>
                                    <input className="input" type="number" style={{ width: 80 }}
                                        value={editing.minRounds || 3}
                                        onChange={(e) => setEditing({ ...editing, minRounds: parseInt(e.target.value) || 3 })}
                                    />
                                </div>
                                <div>
                                    <label className="label">Max Runden</label>
                                    <input className="input" type="number" style={{ width: 80 }}
                                        value={editing.maxRounds || 20}
                                        onChange={(e) => setEditing({ ...editing, maxRounds: parseInt(e.target.value) || 20 })}
                                    />
                                </div>
                            </div>

                            {/* Agent Selection */}
                            <div>
                                <label className="label">Agents im Swarm</label>
                                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                                    {agents.map((a) => (
                                            <button key={a.id} className="btn-secondary"
                                                style={{ fontSize: 12, padding: '4px 10px' }}
                                                onClick={() => addAgentToSwarm(a.id)}>
                                                <Plus size={12} /> {a.name}
                                            </button>
                                        ))
                                    }
                                </div>

                                {/* Selected Agents */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {(editing.agents || []).map((sa) => {
                                        const agent = agents.find((a) => a.id === sa.agentId);
                                        if (!agent) return null;
                                        return (
                                            <div key={sa.id} style={{
                                                padding: 12, borderRadius: 10,
                                                background: 'var(--bg-secondary)',
                                                border: '1px solid var(--border)',
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div style={{
                                                            width: 28, height: 28, borderRadius: 8,
                                                            background: `${agent.color}20`,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontWeight: 700, fontSize: 13, color: agent.color,
                                                        }}>
                                                            {agent.name[0]}
                                                        </div>
                                                        <span style={{ fontWeight: 600, fontSize: 13 }}>{agent.name}</span>
                                                        <span className={`badge badge-${agent.cliTool}`} style={{ fontSize: 10 }}>
                                                            {agent.cliTool}
                                                        </span>
                                                    </div>
                                                    <button onClick={() => removeAgentFromSwarm(sa.id)}
                                                        style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 2 }}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 8 }}>
                                                    <select className="select" style={{ fontSize: 12 }}
                                                        value={sa.role}
                                                        onChange={(e) => updateSwarmAgent(sa.id, { role: e.target.value as SwarmAgent['role'] })}>
                                                        {SWARM_ROLES.map((r) => (
                                                            <option key={r.value} value={r.value}>{r.label}</option>
                                                        ))}
                                                    </select>
                                                    <input className="input" style={{ fontSize: 12 }}
                                                        placeholder="Spezifische Anweisungen fuer diesen Agent..."
                                                        value={sa.instructions}
                                                        onChange={(e) => updateSwarmAgent(sa.id, { instructions: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {(editing.agents || []).length === 0 && (
                                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                                        Fuege Agents hinzu um den Swarm zu konfigurieren
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                                <button className="btn-secondary" onClick={() => setEditing(null)}>Abbrechen</button>
                                <button className="btn-primary" onClick={handleSave}
                                    disabled={!editing.name || !(editing.agents || []).length}>
                                    <Save size={14} /> Speichern
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Layout: Swarm List + Live Output */}
            <div style={{ display: 'grid', gridTemplateColumns: activeSwarm ? '380px 1fr' : '1fr', gap: 20 }}>
                {/* Swarm Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {swarms.length === 0 ? (
                        <div className="card" style={{
                            padding: 60, textAlign: 'center', display: 'flex',
                            flexDirection: 'column', alignItems: 'center', gap: 16,
                        }}>
                            <Network size={48} color="var(--text-muted)" />
                            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                                Noch keine Swarms. Erstelle deinen ersten autonomen Agent Swarm!
                            </p>
                            <button className="btn-primary" onClick={startNew}>
                                <Plus size={16} /> Ersten Swarm erstellen
                            </button>
                        </div>
                    ) : (
                        swarms.map((swarm) => (
                            <div key={swarm.id} className="card" style={{
                                padding: 20,
                                border: activeSwarm === swarm.id ? '1px solid var(--accent)' : undefined,
                                cursor: 'pointer',
                            }}
                                onClick={() => setActiveSwarm(swarm.id)}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{swarm.name}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                            {swarm.description?.slice(0, 100) || 'Kein Ziel definiert'}
                                        </div>
                                    </div>
                                    <div style={{
                                        padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                        background: swarm.status === 'running' ? '#f59e0b20' :
                                            swarm.status === 'completed' ? '#22c55e20' :
                                                swarm.status === 'error' ? '#ef444420' : 'var(--bg-secondary)',
                                        color: swarm.status === 'running' ? '#f59e0b' :
                                            swarm.status === 'completed' ? '#22c55e' :
                                                swarm.status === 'error' ? '#ef4444' : 'var(--text-muted)',
                                    }}>
                                        {swarm.status === 'running' ? 'Laeuft' :
                                            swarm.status === 'completed' ? 'Fertig' :
                                                swarm.status === 'error' ? 'Fehler' : 'Bereit'}
                                    </div>
                                </div>

                                {/* Agent Avatars */}
                                <div style={{ display: 'flex', gap: -4, marginBottom: 12 }}>
                                    {swarm.agents.map((sa) => {
                                        const role = SWARM_ROLES.find((r) => r.value === sa.role);
                                        return (
                                            <div key={sa.agentId} title={`${getAgentName(sa.agentId)} (${sa.role})`}
                                                style={{
                                                    width: 30, height: 30, borderRadius: 8,
                                                    background: `${getAgentColor(sa.agentId)}20`,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontWeight: 700, fontSize: 12, color: getAgentColor(sa.agentId),
                                                    border: sa.role === 'coordinator' ? `2px solid ${role?.color}` : '2px solid transparent',
                                                    marginRight: 4,
                                                }}>
                                                {getAgentName(sa.agentId)[0]}
                                            </div>
                                        );
                                    })}
                                    <div style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
                                        {swarm.agents.length} Agents | Runde {swarm.currentRound} (min {swarm.minRounds || 3} / max {swarm.maxRounds})
                                    </div>
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {swarm.status === 'running' ? (
                                        <button className="btn-danger" style={{ fontSize: 12, padding: '5px 12px' }}
                                            onClick={(e) => { e.stopPropagation(); handleStop(swarm.id); }}>
                                            <Square size={12} /> Stoppen
                                        </button>
                                    ) : (
                                        <button className="btn-primary" style={{ fontSize: 12, padding: '5px 12px' }}
                                            onClick={(e) => { e.stopPropagation(); handleExecute(swarm.id); }}
                                            disabled={executing}>
                                            <Play size={12} /> Starten
                                        </button>
                                    )}
                                    <button onClick={(e) => { e.stopPropagation(); startEdit(swarm); }}
                                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
                                        <Edit3 size={14} />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(swarm.id); }}
                                        style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 4 }}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Live Output Panel */}
                {activeSwarm && (
                    <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 160px)' }}>
                        {/* Panel Header */}
                        <div style={{
                            padding: '14px 20px', borderBottom: '1px solid var(--border)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Network size={16} color="var(--accent)" />
                                <span style={{ fontWeight: 700, fontSize: 14 }}>
                                    {activeSwarmData?.name || 'Swarm Output'}
                                </span>
                                {activeSwarmData?.status === 'running' && (
                                    <div style={{
                                        width: 8, height: 8, borderRadius: '50%',
                                        background: '#22c55e', animation: 'pulse 1.5s infinite',
                                    }} />
                                )}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Runde {activeSwarmData?.currentRound || 0} / {activeSwarmData?.maxRounds || 20}
                            </div>
                        </div>

                        {/* Output Stream */}
                        <div ref={outputRef} style={{
                            flex: 1, overflow: 'auto', padding: '12px 16px',
                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                            fontSize: 12, lineHeight: 1.7,
                            background: '#0a0a10',
                        }}>
                            {swarmMessages.length === 0 && !activeSwarmData?.rounds?.length ? (
                                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
                                    Starte den Swarm um die Live-Ausgabe zu sehen
                                </div>
                            ) : (
                                <>
                                    {/* Live WS messages - real-time stream */}
                                    {swarmMessages.map((m, i) => {
                                        const agentColor = m.agentId ? getAgentColor(m.agentId) : 'var(--accent)';
                                        return (
                                            <div key={`ws-${i}`}>
                                                {m.type === 'swarm_status' && (
                                                    <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: 8 }}>
                                                        {m.data}
                                                    </div>
                                                )}
                                                {m.type === 'swarm_round' && m.data?.startsWith('Round') && (
                                                    <div style={{
                                                        color: '#f59e0b', marginTop: 16, marginBottom: 4, fontWeight: 700,
                                                        borderTop: '1px solid #f59e0b30', paddingTop: 8,
                                                    }}>
                                                        {m.data}
                                                    </div>
                                                )}
                                                {m.type === 'agent_start' && (
                                                    <div style={{ color: agentColor, marginTop: 8, fontWeight: 600, fontSize: 13 }}>
                                                        {'>> '}{m.agentName} arbeitet...
                                                    </div>
                                                )}
                                                {m.type === 'agent_output' && (
                                                    <div style={{ marginLeft: 4, marginBottom: 2 }}>
                                                        <span style={{
                                                            color: agentColor, fontWeight: 600, fontSize: 11,
                                                            marginRight: 6, opacity: 0.7,
                                                        }}>
                                                            {m.agentName}:
                                                        </span>
                                                        <span style={{ color: '#d0d0d8', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                            {m.data}
                                                        </span>
                                                    </div>
                                                )}
                                                {m.type === 'agent_complete' && (
                                                    <div style={{ color: '#22c55e', marginTop: 4, fontSize: 11 }}>
                                                        {'<<'} {m.agentName} fertig
                                                    </div>
                                                )}
                                                {m.type === 'agent_error' && (
                                                    <div style={{ color: '#ef4444', marginTop: 4 }}>
                                                        {m.agentName}: ERROR - {m.error}
                                                    </div>
                                                )}
                                                {m.type === 'swarm_error' && (
                                                    <div style={{ color: '#ef4444', fontWeight: 600, marginTop: 4 }}>
                                                        SWARM ERROR: {m.error}
                                                    </div>
                                                )}
                                                {m.type === 'swarm_complete' && (
                                                    <div style={{
                                                        color: '#22c55e', fontWeight: 700, marginTop: 16,
                                                        fontSize: 14, borderTop: '1px solid #22c55e30', paddingTop: 8,
                                                    }}>
                                                        {m.data}
                                                    </div>
                                                )}
                                                {/* Skip swarm_round that contains full agent output (not a "Round X" header) */}
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function SwarmRoundDisplay({ round, getAgentColor }: {
    round: import('../types').SwarmRound;
    getAgentColor: (id: string) => string;
}) {
    const [expanded, setExpanded] = useState(false);
    const color = getAgentColor(round.agentId);
    const roleColor = SWARM_ROLES.find((r) => r.value === round.role)?.color || '#888';

    return (
        <div style={{ marginBottom: 8, borderLeft: `3px solid ${color}`, paddingLeft: 12 }}>
            <div
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 0' }}
                onClick={() => setExpanded(!expanded)}
            >
                {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span style={{ color: roleColor, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>
                    [{round.role}]
                </span>
                <span style={{ color, fontWeight: 600 }}>{round.agentName}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                    Runde {round.round}
                </span>
            </div>
            {expanded && (
                <div style={{
                    padding: '8px 12px', marginTop: 4, borderRadius: 6,
                    background: 'var(--bg-secondary)', whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word', color: 'var(--text-secondary)',
                    maxHeight: 300, overflow: 'auto',
                }}>
                    {round.output}
                </div>
            )}
        </div>
    );
}
