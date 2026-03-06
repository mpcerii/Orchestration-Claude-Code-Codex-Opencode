import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Agent, Task, AgentTree } from '../types';
import { Bot, GitBranch, KanbanSquare, Zap, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [trees, setTrees] = useState<AgentTree[]>([]);

    useEffect(() => {
        api.getAgents().then(setAgents).catch(() => { });
        api.getTasks().then(setTasks).catch(() => { });
        api.getTrees().then(setTrees).catch(() => { });
    }, []);

    const stats = [
        { label: 'Agents', value: agents.length, icon: Bot, color: '#6366f1', to: '/agents' },
        { label: 'Agent Trees', value: trees.length, icon: GitBranch, color: '#a855f7', to: '/trees' },
        { label: 'Total Tasks', value: tasks.length, icon: KanbanSquare, color: '#22c55e', to: '/kanban' },
        { label: 'Active Tasks', value: tasks.filter(t => t.status === 'in_progress').length, icon: Zap, color: '#f59e0b', to: '/kanban' },
    ];

    return (
        <div className="animate-fade-in">
            <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em' }}>
                    Dashboard
                </h1>
                <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 14 }}>
                    Dein AI-Team im Überblick
                </p>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
                {stats.map((s) => (
                    <Link to={s.to} key={s.label} className="card" style={{ padding: 20, textDecoration: 'none', color: 'inherit' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
                                    {s.label}
                                </div>
                                <div style={{ fontSize: 32, fontWeight: 700, marginTop: 8, color: s.color }}>
                                    {s.value}
                                </div>
                            </div>
                            <div style={{
                                width: 40, height: 40, borderRadius: 10,
                                background: `${s.color}15`, display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                            }}>
                                <s.icon size={20} color={s.color} />
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Recent Agents */}
                <div className="card" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Agents</h2>
                        <Link to="/agents" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                            Alle anzeigen <ArrowRight size={12} />
                        </Link>
                    </div>
                    {agents.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Noch keine Agents erstellt. Starte im Agent Studio!</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {agents.slice(0, 5).map((agent) => (
                                <div key={agent.id} style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '10px 12px', borderRadius: 8,
                                    background: 'var(--bg-secondary)',
                                }}>
                                    <div style={{
                                        width: 32, height: 32, borderRadius: 8,
                                        background: `${agent.color}20`, display: 'flex',
                                        alignItems: 'center', justifyContent: 'center',
                                        fontSize: 14,
                                    }}>
                                        {agent.name[0]}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600 }}>{agent.name}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{agent.roleLabel}</div>
                                    </div>
                                    <span className={`badge badge-${agent.cliTool}`}>{agent.cliTool}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Tasks */}
                <div className="card" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Tasks</h2>
                        <Link to="/kanban" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                            Kanban öffnen <ArrowRight size={12} />
                        </Link>
                    </div>
                    {tasks.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Noch keine Tasks. Erstelle einen im Kanban Board!</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {tasks.slice(0, 5).map((task) => (
                                <div key={task.id} style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '10px 12px', borderRadius: 8,
                                    background: 'var(--bg-secondary)',
                                }}>
                                    <div style={{
                                        width: 8, height: 8, borderRadius: '50%',
                                        background: task.status === 'done' ? 'var(--success)' :
                                            task.status === 'in_progress' ? 'var(--warning)' : 'var(--text-muted)',
                                    }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600 }}>{task.title}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{task.status.replace('_', ' ')}</div>
                                    </div>
                                    <span className="badge" style={{
                                        background: `${task.priority === 'critical' ? '#ef4444' : task.priority === 'high' ? '#f97316' : '#22c55e'}15`,
                                        color: task.priority === 'critical' ? '#ef4444' : task.priority === 'high' ? '#f97316' : '#22c55e',
                                    }}>
                                        {task.priority}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
