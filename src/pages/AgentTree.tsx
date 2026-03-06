import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Agent, AgentTree, TreeNode } from '../types';
import { Plus, Trash2, Save, X, GitBranch, ChevronDown, ChevronRight } from 'lucide-react';

// We can't import uuid in client – use a simple ID generator
function genId(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function createTreeNode(agentId: string): TreeNode {
    return { id: genId(), agentId, children: [], executionMode: 'sequential' };
}

export default function AgentTreePage() {
    const [trees, setTrees] = useState<AgentTree[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [editing, setEditing] = useState<Partial<AgentTree> | null>(null);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        const [t, a] = await Promise.all([api.getTrees(), api.getAgents()]);
        setTrees(t);
        setAgents(a);
    }

    function startNew() {
        setEditing({
            name: '',
            description: '',
            rootNodes: [],
            workspacePath: '',
        });
    }

    function startEdit(tree: AgentTree) {
        setEditing({ ...tree, rootNodes: JSON.parse(JSON.stringify(tree.rootNodes)) });
        // Expand all nodes
        const allIds = new Set<string>();
        function collectIds(nodes: TreeNode[]) {
            nodes.forEach((n) => { allIds.add(n.id); collectIds(n.children); });
        }
        collectIds(tree.rootNodes);
        setExpandedNodes(allIds);
    }

    async function handleSave() {
        if (!editing?.name) return;
        if (editing.id) {
            await api.updateTree(editing.id, editing);
        } else {
            await api.createTree(editing as Omit<AgentTree, 'id' | 'createdAt' | 'updatedAt'>);
        }
        setEditing(null);
        loadData();
    }

    async function handleDelete(id: string) {
        await api.deleteTree(id);
        loadData();
    }

    function addRootNode(agentId: string) {
        if (!editing) return;
        const newNode = createTreeNode(agentId);
        setEditing({ ...editing, rootNodes: [...(editing.rootNodes || []), newNode] });
        setExpandedNodes((prev) => new Set([...prev, newNode.id]));
    }

    function addChildNode(parentId: string, agentId: string) {
        if (!editing) return;
        const newRoots = JSON.parse(JSON.stringify(editing.rootNodes || []));
        function findAndAdd(nodes: TreeNode[]): boolean {
            for (const node of nodes) {
                if (node.id === parentId) {
                    const child = createTreeNode(agentId);
                    node.children.push(child);
                    setExpandedNodes((prev) => new Set([...prev, child.id]));
                    return true;
                }
                if (findAndAdd(node.children)) return true;
            }
            return false;
        }
        findAndAdd(newRoots);
        setEditing({ ...editing, rootNodes: newRoots });
    }

    function removeNode(nodeId: string) {
        if (!editing) return;
        const newRoots = JSON.parse(JSON.stringify(editing.rootNodes || []));
        function removeFrom(nodes: TreeNode[]): TreeNode[] {
            return nodes.filter((n) => {
                if (n.id === nodeId) return false;
                n.children = removeFrom(n.children);
                return true;
            });
        }
        setEditing({ ...editing, rootNodes: removeFrom(newRoots) });
    }

    function toggleExecution(nodeId: string) {
        if (!editing) return;
        const newRoots = JSON.parse(JSON.stringify(editing.rootNodes || []));
        function toggle(nodes: TreeNode[]) {
            for (const n of nodes) {
                if (n.id === nodeId) {
                    n.executionMode = n.executionMode === 'sequential' ? 'parallel' : 'sequential';
                    return;
                }
                toggle(n.children);
            }
        }
        toggle(newRoots);
        setEditing({ ...editing, rootNodes: newRoots });
    }

    function toggleExpand(nodeId: string) {
        setExpandedNodes((prev) => {
            const next = new Set(prev);
            next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId);
            return next;
        });
    }

    function getAgent(agentId: string): Agent | undefined {
        return agents.find((a) => a.id === agentId);
    }

    function renderNode(node: TreeNode, depth: number = 0) {
        const agent = getAgent(node.agentId);
        const isExpanded = expandedNodes.has(node.id);
        const hasChildren = node.children.length > 0;

        return (
            <div key={node.id} style={{ marginLeft: depth * 28 }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', borderRadius: 8,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    marginBottom: 4,
                }}>
                    {/* Expand/collapse */}
                    <button onClick={() => toggleExpand(node.id)} style={{
                        background: 'none', border: 'none', color: 'var(--text-muted)',
                        cursor: 'pointer', padding: 2, visibility: hasChildren ? 'visible' : 'hidden',
                    }}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>

                    {/* Connection line indicator */}
                    {depth > 0 && (
                        <div style={{
                            width: 12, height: 2, background: 'var(--border)',
                            position: 'relative', left: -8,
                        }} />
                    )}

                    {/* Agent info */}
                    <div style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: agent ? `${agent.color}20` : 'var(--bg-card)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, color: agent?.color || 'var(--text-muted)',
                    }}>
                        {agent?.name[0] || '?'}
                    </div>

                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{agent?.name || 'Unknown'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {agent?.roleLabel} • {agent?.cliTool}
                        </div>
                    </div>

                    {/* Execution mode badge */}
                    <button onClick={() => toggleExecution(node.id)} className="badge" style={{
                        cursor: 'pointer', border: 'none',
                        background: node.executionMode === 'parallel' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-card)',
                        color: node.executionMode === 'parallel' ? '#6366f1' : 'var(--text-muted)',
                    }}>
                        {node.executionMode === 'parallel' ? '⇉ Parallel' : '↓ Sequential'}
                    </button>

                    {/* Add child */}
                    <select style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: 6, padding: '2px 6px', fontSize: 11,
                        color: 'var(--text-muted)', cursor: 'pointer', maxWidth: 100,
                    }}
                        value=""
                        onChange={(e) => { if (e.target.value) addChildNode(node.id, e.target.value); }}
                    >
                        <option value="">+ Kind</option>
                        {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>

                    {/* Remove */}
                    <button onClick={() => removeNode(node.id)} style={{
                        background: 'none', border: 'none', color: 'var(--error)',
                        cursor: 'pointer', padding: 2,
                    }}>
                        <Trash2 size={12} />
                    </button>
                </div>

                {/* Children */}
                {isExpanded && node.children.map((child) => renderNode(child, depth + 1))}
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em' }}>Agent Trees</h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 14 }}>
                        Baue Hierarchien – Output fließt von oben nach unten
                    </p>
                </div>
                <button className="btn-primary" onClick={startNew} disabled={agents.length === 0}>
                    <Plus size={16} /> Neuer Tree
                </button>
            </div>

            {agents.length === 0 && (
                <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
                    ⚠️ Erstelle zuerst Agents im Agent Studio, bevor du Trees bauen kannst.
                </div>
            )}

            {/* Tree Editor Modal */}
            {editing && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
                }}>
                    <div className="card" style={{ width: 700, maxHeight: '85vh', padding: 28, overflow: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                                {editing.id ? 'Tree bearbeiten' : 'Neuer Agent Tree'}
                            </h2>
                            <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label className="label">Name</label>
                                    <input className="input" placeholder="Feature Development Pipeline"
                                        value={editing.name || ''}
                                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="label">Workspace Pfad</label>
                                    <input className="input" placeholder="C:"
                                        value={editing.workspacePath || ''}
                                        onChange={(e) => setEditing({ ...editing, workspacePath: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="label">Beschreibung</label>
                                <input className="input" placeholder="Pipeline für Feature-Entwicklung mit Code Review"
                                    value={editing.description || ''}
                                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                                />
                            </div>

                            {/* Tree hierarchy */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <label className="label" style={{ marginBottom: 0 }}>Agent Hierarchie</label>
                                    <select style={{
                                        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                        borderRadius: 6, padding: '4px 10px', fontSize: 12,
                                        color: 'var(--text-primary)', cursor: 'pointer',
                                    }}
                                        value=""
                                        onChange={(e) => { if (e.target.value) addRootNode(e.target.value); }}
                                    >
                                        <option value="">+ Root Agent hinzufügen</option>
                                        {agents.map((a) => (
                                            <option key={a.id} value={a.id}>{a.name} ({a.roleLabel})</option>
                                        ))}
                                    </select>
                                </div>

                                <div style={{
                                    background: 'var(--bg-primary)', borderRadius: 10, padding: 16,
                                    border: '1px solid var(--border)', minHeight: 120,
                                }}>
                                    {(editing.rootNodes || []).length === 0 ? (
                                        <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>
                                            Füge Root-Agents hinzu um den Tree zu starten
                                        </p>
                                    ) : (
                                        (editing.rootNodes || []).map((node) => renderNode(node))
                                    )}
                                </div>
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

            {/* Tree List */}
            {trees.length === 0 ? (
                <div className="card" style={{
                    padding: 60, textAlign: 'center', display: 'flex',
                    flexDirection: 'column', alignItems: 'center', gap: 16,
                }}>
                    <GitBranch size={48} color="var(--text-muted)" />
                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                        Noch keine Agent Trees. Baue deine erste Pipeline!
                    </p>
                    <button className="btn-primary" onClick={startNew} disabled={agents.length === 0}>
                        <Plus size={16} /> Ersten Tree erstellen
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
                    {trees.map((tree) => (
                        <div key={tree.id} className="card" style={{ padding: 20, cursor: 'pointer' }}
                            onClick={() => startEdit(tree)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                    <div style={{
                                        width: 40, height: 40, borderRadius: 10,
                                        background: 'rgba(168, 85, 247, 0.1)', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <GitBranch size={20} color="#a855f7" />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 15 }}>{tree.name}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{tree.description}</div>
                                    </div>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(tree.id); }} style={{
                                    background: 'none', border: 'none', color: 'var(--error)',
                                    cursor: 'pointer', padding: 4,
                                }}>
                                    <Trash2 size={14} />
                                </button>
                            </div>

                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {countAgents(tree.rootNodes).map(({ agent, count }) => (
                                    <span key={agent.id} className={`badge badge-${agent.cliTool}`}>
                                        {agent.name}{count > 1 ? ` ×${count}` : ''}
                                    </span>
                                ))}
                            </div>

                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
                                📁 {tree.workspacePath || 'Kein Pfad'}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    function countAgents(nodes: TreeNode[]): { agent: Agent; count: number }[] {
        const map = new Map<string, number>();
        function walk(ns: TreeNode[]) {
            ns.forEach((n) => {
                map.set(n.agentId, (map.get(n.agentId) || 0) + 1);
                walk(n.children);
            });
        }
        walk(nodes);
        const result: { agent: Agent; count: number }[] = [];
        map.forEach((count, id) => {
            const agent = agents.find((a) => a.id === id);
            if (agent) result.push({ agent, count });
        });
        return result;
    }
}
