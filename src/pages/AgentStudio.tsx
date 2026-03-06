import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Agent, CliTool, AgentRole } from '../types';
import { ROLE_OPTIONS, CLI_TOOLS } from '../types';
import { Plus, Trash2, Edit3, Save, X, Bot } from 'lucide-react';

const DEFAULT_AGENT: Partial<Agent> = {
    name: '',
    role: 'developer',
    roleLabel: 'Developer',
    cliTool: 'claude',
    model: 'sonnet',
    systemPrompt: '',
    extraArgs: [],
    color: '#6366f1',
};

export default function AgentStudio() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [editing, setEditing] = useState<Partial<Agent> | null>(null);

    useEffect(() => {
        loadAgents();
    }, []);

    async function loadAgents() {
        const data = await api.getAgents();
        setAgents(data);
    }

    function startNew() {
        setEditing({ ...DEFAULT_AGENT });
    }

    function startEdit(agent: Agent) {
        setEditing({ ...agent });
    }

    async function handleSave() {
        if (!editing?.name) return;
        if (editing.id) {
            await api.updateAgent(editing.id, editing);
        } else {
            await api.createAgent(editing);
        }
        setEditing(null);
        loadAgents();
    }

    async function handleDelete(id: string) {
        await api.deleteAgent(id);
        loadAgents();
    }

    function handleToolChange(tool: CliTool) {
        setEditing((prev) => prev ? { ...prev, cliTool: tool, model: '' } : null);
    }

    function handleRoleChange(role: AgentRole) {
        const opt = ROLE_OPTIONS.find((r) => r.value === role);
        setEditing((prev) => prev ? { ...prev, role, roleLabel: opt?.label || role } : null);
    }

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em' }}>Agent Studio</h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 14 }}>
                        Erstelle und verwalte deine AI-Agenten
                    </p>
                </div>
                <button className="btn-primary" onClick={startNew}>
                    <Plus size={16} /> Neuer Agent
                </button>
            </div>

            {/* Editor Modal */}
            {editing && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
                }}>
                    <div className="card" style={{ width: 560, padding: 28, animation: 'fadeIn 0.2s ease-out' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                                {editing.id ? 'Agent bearbeiten' : 'Neuer Agent'}
                            </h2>
                            <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {/* Name */}
                            <div>
                                <label className="label">Name</label>
                                <input className="input" placeholder="z.B. Claude CEO"
                                    value={editing.name || ''}
                                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                                />
                            </div>

                            {/* Tool + Model */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label className="label">CLI Tool</label>
                                    <select className="select" value={editing.cliTool || 'claude'}
                                        onChange={(e) => handleToolChange(e.target.value as CliTool)}>
                                        {CLI_TOOLS.map((t) => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <div>
                                        <label className="label">Model</label>
                                        <input className="input"
                                            placeholder={editing.cliTool === 'claude' ? 'z.B. sonnet, opus, haiku' :
                                                editing.cliTool === 'gemini' ? 'z.B. gemini-2.5-pro' :
                                                    editing.cliTool === 'codex' ? 'z.B. o3, o4-mini' :
                                                        'z.B. anthropic/claude-sonnet-4-6'}
                                            value={editing.model || ''}
                                            onChange={(e) => setEditing({ ...editing, model: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Role + Color */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                                <div>
                                    <label className="label">Rolle</label>
                                    <select className="select" value={editing.role || 'developer'}
                                        onChange={(e) => handleRoleChange(e.target.value as AgentRole)}>
                                        {ROLE_OPTIONS.map((r) => (
                                            <option key={r.value} value={r.value}>{r.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Farbe</label>
                                    <input type="color" value={editing.color || '#6366f1'} style={{
                                        width: 46, height: 38, border: '1px solid var(--border)', borderRadius: 8,
                                        background: 'var(--bg-secondary)', cursor: 'pointer', padding: 2,
                                    }}
                                        onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* System Prompt */}
                            <div>
                                <label className="label">System Prompt</label>
                                <textarea className="textarea" rows={5}
                                    placeholder="Du bist ein erfahrener Senior Developer..."
                                    value={editing.systemPrompt || ''}
                                    onChange={(e) => setEditing({ ...editing, systemPrompt: e.target.value })}
                                />
                            </div>

                            {/* Extra Args */}
                            <div>
                                <label className="label">Extra CLI Argumente (kommagetrennt)</label>
                                <input className="input"
                                    placeholder="--verbose, --max-budget-usd 5"
                                    value={(editing.extraArgs || []).join(', ')}
                                    onChange={(e) => setEditing({
                                        ...editing,
                                        extraArgs: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                                    })}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                                <button className="btn-secondary" onClick={() => setEditing(null)}>Abbrechen</button>
                                <button className="btn-primary" onClick={handleSave}>
                                    <Save size={14} /> Speichern
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Agent Grid */}
            {agents.length === 0 ? (
                <div className="card" style={{
                    padding: 60, textAlign: 'center', display: 'flex',
                    flexDirection: 'column', alignItems: 'center', gap: 16,
                }}>
                    <Bot size={48} color="var(--text-muted)" />
                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                        Noch keine Agents. Erstelle deinen ersten AI-Agenten!
                    </p>
                    <button className="btn-primary" onClick={startNew}>
                        <Plus size={16} /> Ersten Agent erstellen
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                    {agents.map((agent) => (
                        <div key={agent.id} className="card" style={{ padding: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{
                                        width: 44, height: 44, borderRadius: 12,
                                        background: `${agent.color}20`, display: 'flex',
                                        alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 700, fontSize: 18, color: agent.color,
                                    }}>
                                        {agent.name[0]}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 15 }}>{agent.name}</div>
                                        <div className={`role-${agent.role}`} style={{ fontSize: 12, fontWeight: 600 }}>
                                            {agent.roleLabel}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <button onClick={() => startEdit(agent)} style={{
                                        background: 'none', border: 'none', color: 'var(--text-muted)',
                                        cursor: 'pointer', padding: 4,
                                    }}>
                                        <Edit3 size={14} />
                                    </button>
                                    <button onClick={() => handleDelete(agent.id)} style={{
                                        background: 'none', border: 'none', color: 'var(--error)',
                                        cursor: 'pointer', padding: 4,
                                    }}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                <span className={`badge badge-${agent.cliTool}`}>{agent.cliTool}</span>
                                <span className="badge" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                                    {agent.model || 'default'}
                                </span>
                            </div>

                            {agent.systemPrompt && (
                                <div style={{
                                    padding: 10, borderRadius: 8, background: 'var(--bg-secondary)',
                                    fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5,
                                    maxHeight: 60, overflow: 'hidden',
                                    fontFamily: "'JetBrains Mono', monospace",
                                }}>
                                    {agent.systemPrompt.slice(0, 120)}
                                    {agent.systemPrompt.length > 120 && '...'}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
