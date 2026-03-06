import { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import type { Task, TaskStatus, TaskPriority, AgentTree } from '../types';
import { STATUS_LABELS, PRIORITY_COLORS } from '../types';
import { Plus, Play, Trash2, X, Save, GripVertical } from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';
import type { WsMessage } from '../types';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
    closestCenter,
    type DragStartEvent,
    type DragEndEvent,
    type DragOverEvent,
    useDroppable,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const COLUMNS: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'review', 'done'];

const DEFAULT_TASK: Partial<Task> = {
    title: '',
    description: '',
    status: 'backlog',
    priority: 'medium',
    prompt: '',
};

// ─── Droppable Column ─────────────────────────────────────────
function DroppableColumn({
    status,
    tasks,
    children,
}: {
    status: TaskStatus;
    tasks: Task[];
    children: React.ReactNode;
}) {
    const { setNodeRef, isOver } = useDroppable({ id: `column-${status}` });

    return (
        <div
            ref={setNodeRef}
            style={{
                background: isOver ? 'var(--bg-elevated)' : 'var(--bg-secondary)',
                borderRadius: 12,
                padding: 12,
                border: isOver ? '1px solid var(--accent)' : '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 200,
                transition: 'all 0.2s ease',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 12,
                    padding: '4px 4px',
                }}
            >
                <span
                    style={{
                        fontSize: 12,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: 'var(--text-muted)',
                    }}
                >
                    {STATUS_LABELS[status]}
                </span>
                <span
                    style={{
                        fontSize: 11,
                        background: 'var(--bg-card)',
                        padding: '2px 8px',
                        borderRadius: 10,
                        color: 'var(--text-muted)',
                    }}
                >
                    {tasks.length}
                </span>
            </div>
            <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    {children}
                </div>
            </SortableContext>
        </div>
    );
}

// ─── Sortable Task Card ───────────────────────────────────────
function SortableTaskCard({
    task,
    col,
    onStatusChange,
    onExecute,
    onEdit,
    onDelete,
}: {
    task: Task;
    col: TaskStatus;
    onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
    onExecute: (taskId: string) => void;
    onEdit: (task: Task) => void;
    onDelete: (taskId: string) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: task.id,
        data: { task, status: col },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes}>
            <div
                className="card"
                style={{
                    padding: 14,
                    borderLeft: `3px solid ${PRIORITY_COLORS[task.priority]}`,
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{task.title}</div>
                    <div {...listeners} style={{ cursor: 'grab', padding: 2 }}>
                        <GripVertical size={14} color="var(--text-muted)" />
                    </div>
                </div>
                {task.description && (
                    <p
                        style={{
                            fontSize: 12,
                            color: 'var(--text-muted)',
                            marginTop: 6,
                            lineHeight: 1.4,
                        }}
                    >
                        {task.description.slice(0, 80)}
                        {task.description.length > 80 && '...'}
                    </p>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center' }}>
                    {col !== 'done' && (
                        <button
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                            onClick={() => onStatusChange(task.id, COLUMNS[COLUMNS.indexOf(col) + 1])}
                        >
                            →
                        </button>
                    )}
                    {task.status !== 'done' && task.status !== 'in_progress' && (
                        <button
                            className="btn-primary"
                            style={{
                                padding: '4px 8px',
                                fontSize: 11,
                                opacity: task.assignedTreeId ? 1 : 0.6,
                            }}
                            title={task.assignedTreeId ? 'Agent Tree ausführen' : 'Zuerst einen Agent Tree zuweisen!'}
                            onClick={() => {
                                if (!task.assignedTreeId) {
                                    onEdit(task); // Open editor so user can assign a tree
                                } else {
                                    onExecute(task.id);
                                }
                            }}
                        >
                            <Play size={10} /> {task.assignedTreeId ? 'Run' : 'Run ⚠'}
                        </button>
                    )}
                    {task.status === 'in_progress' && (
                        <span style={{
                            fontSize: 11,
                            color: 'var(--warning)',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                        }}>
                            ⏳ Running...
                        </span>
                    )}
                    <button
                        onClick={() => onEdit(task)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: 2,
                        }}
                    >
                        <span style={{ fontSize: 11 }}>✏️</span>
                    </button>
                    <button
                        onClick={() => onDelete(task.id)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--error)',
                            cursor: 'pointer',
                            padding: 2,
                            marginLeft: 'auto',
                        }}
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Drag Overlay Card (ghost while dragging) ─────────────────
function TaskOverlayCard({ task }: { task: Task }) {
    return (
        <div
            className="card card-glow"
            style={{
                padding: 14,
                borderLeft: `3px solid ${PRIORITY_COLORS[task.priority]}`,
                width: 260,
                cursor: 'grabbing',
            }}
        >
            <div style={{ fontSize: 13, fontWeight: 600 }}>{task.title}</div>
            {task.description && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                    {task.description.slice(0, 60)}...
                </p>
            )}
        </div>
    );
}

// ─── LocalStorage helpers for persistent output ──────────────
const OUTPUT_STORAGE_KEY = 'aio_task_output_';

function saveOutputToStorage(taskId: string, msgs: WsMessage[]) {
    try {
        localStorage.setItem(OUTPUT_STORAGE_KEY + taskId, JSON.stringify(msgs));
    } catch { /* quota exceeded – ignore */ }
}

function loadOutputFromStorage(taskId: string): WsMessage[] {
    try {
        const raw = localStorage.getItem(OUTPUT_STORAGE_KEY + taskId);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

// ─── Main Component ───────────────────────────────────────────
export default function KanbanBoard() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [trees, setTrees] = useState<AgentTree[]>([]);
    const [editing, setEditing] = useState<Partial<Task> | null>(null);
    const [activeOutput, setActiveOutput] = useState<string | null>(null);
    const [cachedMessages, setCachedMessages] = useState<WsMessage[]>([]);
    const [activeTask, setActiveTask] = useState<Task | null>(null);
    const [executing, setExecuting] = useState(false);
    const { messages } = useWebSocket();
    const initialLoadDone = useRef(false);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    useEffect(() => {
        loadData();
    }, []);

    // Auto-detect in-progress tasks on page load and restore output panel
    useEffect(() => {
        if (initialLoadDone.current || tasks.length === 0) return;
        initialLoadDone.current = true;

        const runningTask = tasks.find((t) => t.status === 'in_progress');
        if (runningTask) {
            setActiveOutput(runningTask.id);
            const cached = loadOutputFromStorage(runningTask.id);
            if (cached.length > 0) {
                setCachedMessages(cached);
            }
        }
    }, [tasks]);

    // Auto-refresh task list when a task completes or errors via WebSocket
    useEffect(() => {
        const hasCompletion = messages.some(
            (m) => m.type === 'task_complete' || m.type === 'agent_error'
        );
        if (hasCompletion) {
            loadData();
        }
    }, [messages]);

    // Persist new WS messages to localStorage when they arrive
    useEffect(() => {
        if (!activeOutput) return;
        const relevant = messages.filter((m) => m.taskId === activeOutput);
        if (relevant.length > 0) {
            // Merge cached + new, deduplicate
            const all = [...cachedMessages, ...relevant];
            // Simple dedup by index (cached may overlap with live)
            const seen = new Set<string>();
            const deduped = all.filter((m) => {
                const key = `${m.type}-${m.agentId || ''}-${m.data || m.error || ''}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            saveOutputToStorage(activeOutput, deduped);
        }
    }, [messages, activeOutput, cachedMessages]);

    async function loadData() {
        const [t, tr] = await Promise.all([api.getTasks(), api.getTrees()]);
        setTasks(t);
        setTrees(tr);
    }

    function startNew(status: TaskStatus = 'backlog') {
        setEditing({ ...DEFAULT_TASK, status });
    }

    async function handleSave() {
        if (!editing?.title) return;
        if (editing.id) {
            await api.updateTask(editing.id, editing);
        } else {
            await api.createTask(editing as Omit<Task, 'id' | 'outputs' | 'createdAt' | 'updatedAt'>);
        }
        setEditing(null);
        loadData();
    }

    async function handleDelete(id: string) {
        await api.deleteTask(id);
        loadData();
    }

    async function handleStatusChange(taskId: string, newStatus: TaskStatus) {
        await api.updateTask(taskId, { status: newStatus });
        loadData();
    }

    async function handleExecute(taskId: string) {
        if (executing) return;
        setExecuting(true);
        try {
            setActiveOutput(taskId);
            setCachedMessages([]);  // Reset cached messages for new execution
            saveOutputToStorage(taskId, []);  // Clear old cached output
            await api.executeTask(taskId);
            loadData();
        } catch (err) {
            console.error('Execute failed:', err);
            loadData();
        } finally {
            setExecuting(false);
        }
    }

    // ─── DnD Handlers ─────────────────────────────────────
    function handleDragStart(event: DragStartEvent) {
        const task = tasks.find((t) => t.id === event.active.id);
        if (task) setActiveTask(task);
    }

    async function handleDragEnd(event: DragEndEvent) {
        setActiveTask(null);
        const { active, over } = event;
        if (!over) return;

        const taskId = active.id as string;
        let targetStatus: TaskStatus | null = null;

        // Dropped over a column
        if (typeof over.id === 'string' && over.id.startsWith('column-')) {
            targetStatus = over.id.replace('column-', '') as TaskStatus;
        }
        // Dropped over another task card → find its column
        else {
            const overTask = tasks.find((t) => t.id === over.id);
            if (overTask) targetStatus = overTask.status;
        }

        if (targetStatus) {
            const task = tasks.find((t) => t.id === taskId);
            if (task && task.status !== targetStatus) {
                // Optimistic update
                setTasks((prev) =>
                    prev.map((t) => (t.id === taskId ? { ...t, status: targetStatus! } : t))
                );
                await api.updateTask(taskId, { status: targetStatus });
                loadData();
            }
        }
    }

    function handleDragOver(_event: DragOverEvent) {
        // Could implement preview swaps here
    }

    // Merge cached (persisted) + live WS messages, deduplicate
    const taskMessages = (() => {
        const live = messages.filter((m) => m.taskId === activeOutput);
        if (live.length > 0) return live;  // Live messages available, use them
        return cachedMessages;  // Fallback to cached from localStorage
    })();

    return (
        <div className="animate-fade-in">
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 32,
                }}
            >
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em' }}>Kanban Board</h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 14 }}>
                        Verwalte Tasks und starte Agent-Workflows
                    </p>
                </div>
                <button className="btn-primary" onClick={() => startNew()}>
                    <Plus size={16} /> Neuer Task
                </button>
            </div>

            {/* Kanban Columns with DnD */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${COLUMNS.length}, 1fr)`,
                        gap: 12,
                        minHeight: '60vh',
                    }}
                >
                    {COLUMNS.map((col) => {
                        const colTasks = tasks.filter((t) => t.status === col);
                        return (
                            <DroppableColumn key={col} status={col} tasks={colTasks}>
                                {colTasks.map((task) => (
                                    <SortableTaskCard
                                        key={task.id}
                                        task={task}
                                        col={col}
                                        onStatusChange={handleStatusChange}
                                        onExecute={handleExecute}
                                        onEdit={(t) => setEditing({ ...t })}
                                        onDelete={handleDelete}
                                    />
                                ))}

                                {/* Add task to column */}
                                <button
                                    onClick={() => startNew(col)}
                                    style={{
                                        background: 'none',
                                        border: '1px dashed var(--border)',
                                        borderRadius: 8,
                                        padding: 10,
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                        fontSize: 12,
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    <Plus size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Hinzufügen
                                </button>
                            </DroppableColumn>
                        );
                    })}
                </div>

                {/* Drag Overlay – the ghost card that follows the cursor */}
                <DragOverlay>
                    {activeTask ? <TaskOverlayCard task={activeTask} /> : null}
                </DragOverlay>
            </DndContext>

            {/* Task Editor Modal */}
            {editing && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 100,
                    }}
                >
                    <div className="card" style={{ width: 520, padding: 28 }}>
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 24,
                            }}
                        >
                            <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                                {editing.id ? 'Task bearbeiten' : 'Neuer Task'}
                            </h2>
                            <button
                                onClick={() => setEditing(null)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                                <label className="label">Titel</label>
                                <input
                                    className="input"
                                    placeholder="Implementiere Feature X"
                                    value={editing.title || ''}
                                    onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="label">Beschreibung</label>
                                <textarea
                                    className="textarea"
                                    rows={3}
                                    placeholder="Details zum Task..."
                                    value={editing.description || ''}
                                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="label">Prompt (wird an den Agent Tree gesendet)</label>
                                <textarea
                                    className="textarea"
                                    rows={4}
                                    placeholder="Erstelle eine REST API für..."
                                    value={editing.prompt || ''}
                                    onChange={(e) => setEditing({ ...editing, prompt: e.target.value })}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                                <div>
                                    <label className="label">Status</label>
                                    <select
                                        className="select"
                                        value={editing.status || 'backlog'}
                                        onChange={(e) =>
                                            setEditing({ ...editing, status: e.target.value as TaskStatus })
                                        }
                                    >
                                        {COLUMNS.map((s) => (
                                            <option key={s} value={s}>
                                                {STATUS_LABELS[s]}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Priorität</label>
                                    <select
                                        className="select"
                                        value={editing.priority || 'medium'}
                                        onChange={(e) =>
                                            setEditing({ ...editing, priority: e.target.value as TaskPriority })
                                        }
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="critical">Critical</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Agent Tree</label>
                                    <select
                                        className="select"
                                        value={editing.assignedTreeId || ''}
                                        onChange={(e) =>
                                            setEditing({ ...editing, assignedTreeId: e.target.value || undefined })
                                        }
                                    >
                                        <option value="">Kein Tree</option>
                                        {trees.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                                <button className="btn-secondary" onClick={() => setEditing(null)}>
                                    Abbrechen
                                </button>
                                <button className="btn-primary" onClick={handleSave}>
                                    <Save size={14} /> Speichern
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Agent Output Terminal Panel ─────────────────── */}
            {activeOutput && taskMessages.length > 0 && (() => {
                // Group messages by agent
                const agentMap = new Map<string, {
                    name: string;
                    id: string;
                    status: 'running' | 'completed' | 'error';
                    messages: typeof taskMessages;
                }>();

                taskMessages.forEach((m) => {
                    const key = m.agentId || '__task__';
                    if (!agentMap.has(key)) {
                        agentMap.set(key, {
                            name: m.agentName || 'System',
                            id: key,
                            status: 'running',
                            messages: [],
                        });
                    }
                    const entry = agentMap.get(key)!;
                    entry.messages.push(m);
                    if (m.type === 'agent_complete') entry.status = 'completed';
                    if (m.type === 'agent_error') entry.status = 'error';
                });

                const agents = Array.from(agentMap.values());
                const isTaskDone = taskMessages.some((m) => m.type === 'task_complete');

                return (
                    <div
                        className="card"
                        style={{
                            position: 'fixed',
                            bottom: 0,
                            right: 0,
                            width: 650,
                            maxHeight: 500,
                            zIndex: 90,
                            display: 'flex',
                            flexDirection: 'column',
                            borderRadius: '12px 0 0 0',
                            border: '1px solid var(--border)',
                            borderRight: 'none',
                            borderBottom: 'none',
                        }}
                    >
                        {/* Header */}
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '12px 16px',
                                borderBottom: '1px solid var(--border)',
                                background: 'var(--bg-elevated)',
                                borderRadius: '12px 0 0 0',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        background: isTaskDone
                                            ? 'var(--success)'
                                            : 'var(--warning)',
                                        animation: isTaskDone ? 'none' : 'pulse-glow 1.5s ease-in-out infinite',
                                    }}
                                />
                                <h3 style={{ fontSize: 13, fontWeight: 700 }}>
                                    {isTaskDone ? '✅ Task abgeschlossen' : '⚡ Agents arbeiten...'}
                                </h3>
                                <span
                                    style={{
                                        fontSize: 11,
                                        color: 'var(--text-muted)',
                                        background: 'var(--bg-primary)',
                                        padding: '2px 8px',
                                        borderRadius: 6,
                                    }}
                                >
                                    {agents.length} Agent{agents.length > 1 ? 's' : ''}
                                </span>
                            </div>
                            <button
                                onClick={() => setActiveOutput(null)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    padding: 4,
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Agent sections */}
                        <div
                            style={{
                                flex: 1,
                                overflow: 'auto',
                                padding: 12,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 12,
                            }}
                        >
                            {agents.map((agent) => (
                                <div
                                    key={agent.id}
                                    style={{
                                        borderRadius: 8,
                                        border: '1px solid var(--border)',
                                        overflow: 'hidden',
                                    }}
                                >
                                    {/* Agent header */}
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            padding: '8px 12px',
                                            background: 'var(--bg-elevated)',
                                            borderBottom: '1px solid var(--border)',
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: 13,
                                            }}
                                        >
                                            {agent.status === 'running' && '🔄'}
                                            {agent.status === 'completed' && '✅'}
                                            {agent.status === 'error' && '❌'}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: 12,
                                                fontWeight: 700,
                                                color: 'var(--text-primary)',
                                            }}
                                        >
                                            {agent.name}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: 10,
                                                color: agent.status === 'running'
                                                    ? 'var(--warning)'
                                                    : agent.status === 'completed'
                                                        ? 'var(--success)'
                                                        : 'var(--error)',
                                                fontWeight: 600,
                                                textTransform: 'uppercase',
                                                marginLeft: 'auto',
                                            }}
                                        >
                                            {agent.status === 'running' && 'Arbeitet...'}
                                            {agent.status === 'completed' && 'Fertig'}
                                            {agent.status === 'error' && 'Fehler'}
                                        </span>
                                    </div>

                                    {/* Agent terminal output */}
                                    <div
                                        style={{
                                            padding: '8px 12px',
                                            background: '#0d0d14',
                                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                            fontSize: 11,
                                            lineHeight: 1.6,
                                            maxHeight: 200,
                                            overflow: 'auto',
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                        }}
                                    >
                                        {agent.messages.map((m, i) => (
                                            <div key={i}>
                                                {m.type === 'agent_start' && (
                                                    <span style={{ color: '#4285f4' }}>
                                                        {'>'} {m.data}{'\n'}
                                                    </span>
                                                )}
                                                {m.type === 'agent_output' && (
                                                    <span style={{ color: '#c8c8d0' }}>{m.data}</span>
                                                )}
                                                {m.type === 'agent_complete' && (
                                                    <span style={{ color: '#22c55e' }}>
                                                        {'\n'}{'─'.repeat(40)}{'\n'}
                                                        ✓ {m.agentName} abgeschlossen
                                                    </span>
                                                )}
                                                {m.type === 'agent_error' && (
                                                    <span style={{ color: '#ef4444' }}>
                                                        ✗ ERROR: {m.error}
                                                    </span>
                                                )}
                                                {m.type === 'task_complete' && (
                                                    <span style={{ color: '#22c55e', fontWeight: 700 }}>
                                                        {'\n'}🎉 {m.data}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
