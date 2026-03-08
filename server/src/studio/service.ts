import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { getStudioDb } from './db.js';
import type {
  AgentMessage,
  AgentRun,
  Artifact,
  MemoryEntry,
  Schedule,
  StudioAgent,
  StudioBootstrap,
  StudioEvent,
  ToolCall,
} from './types.js';

const db = getStudioDb();
const studioEvents = new EventEmitter();
type SqlParams = Record<string, string | number | null>;

const defaultTools = [
  { name: 'shell_exec', description: 'Runs shell commands inside the workspace jail.' },
  { name: 'read_file', description: 'Reads files from the active project workspace.' },
  { name: 'write_file', description: 'Writes generated artifacts into the workspace.' },
  { name: 'list_files', description: 'Lists project files and artifacts.' },
  { name: 'git_status', description: 'Reports repository state and local changes.' },
  { name: 'git_diff', description: 'Returns pending source changes.' },
  { name: 'run_tests', description: 'Executes selected test suites.' },
  { name: 'search_code', description: 'Searches code and symbols inside the project.' },
  { name: 'web_lookup', description: 'Optional research tool for external context.' },
] as const;

const seedAgents: StudioAgent[] = [
  { id: randomUUID(), name: 'Orchestrator', role: 'Coordinator', model: 'gpt-4.1-mini', endpoint: 'http://localhost:11434/v1', color: '#ff9f43', status: 'idle' },
  { id: randomUUID(), name: 'Planner', role: 'Planning', model: 'gpt-4.1-mini', endpoint: 'http://localhost:11434/v1', color: '#00c2a8', status: 'idle' },
  { id: randomUUID(), name: 'Researcher', role: 'Research', model: 'gpt-4.1-mini', endpoint: 'http://localhost:11434/v1', color: '#36a2ff', status: 'idle' },
  { id: randomUUID(), name: 'Coder', role: 'Implementation', model: 'gpt-4.1', endpoint: 'http://localhost:11434/v1', color: '#ff5d73', status: 'idle' },
  { id: randomUUID(), name: 'Reviewer', role: 'Review', model: 'gpt-4.1-mini', endpoint: 'http://localhost:11434/v1', color: '#8f7cff', status: 'idle' },
  { id: randomUUID(), name: 'Tester', role: 'Validation', model: 'gpt-4.1-mini', endpoint: 'http://localhost:11434/v1', color: '#ffd166', status: 'idle' },
  { id: randomUUID(), name: 'File Manager', role: 'Artifacts', model: 'gpt-4.1-mini', endpoint: 'http://localhost:11434/v1', color: '#7bd389', status: 'idle' },
];

const seedSchedules = [
  { id: randomUUID(), name: 'Regression Suite', cron: '0 */6 * * *', timezone: 'Europe/Berlin', jobType: 'regression_suite', status: 'active', lastRunAt: null, nextRunAt: null },
  { id: randomUUID(), name: 'Memory Compaction', cron: '15 2 * * *', timezone: 'Europe/Berlin', jobType: 'memory_compaction', status: 'active', lastRunAt: null, nextRunAt: null },
  { id: randomUUID(), name: 'Repo Sync', cron: '*/30 * * * *', timezone: 'Europe/Berlin', jobType: 'repo_sync', status: 'paused', lastRunAt: null, nextRunAt: null },
];

const seedMemory = [
  { id: randomUUID(), scope: 'project', kind: 'decision', title: 'MVP persistence', content: 'SQLite is the local source of truth for runs, events, schedules, memory, and artifacts.', createdAt: new Date().toISOString() },
  { id: randomUUID(), scope: 'project', kind: 'fact', title: 'Primary model transport', content: 'Model providers are expected behind OpenAI-compatible local endpoints such as Ollama or LM Studio.', createdAt: new Date().toISOString() },
];

function asRows<T>(sql: string, params: SqlParams = {}): T[] {
  return db.prepare(sql).all(params) as T[];
}

function asRow<T>(sql: string, params: SqlParams = {}): T | undefined {
  return db.prepare(sql).get(params) as T | undefined;
}

function seedIfEmpty() {
  const agentCount = asRow<{ count: number }>('SELECT COUNT(*) as count FROM studio_agents')?.count ?? 0;
  if (agentCount === 0) {
    const insert = db.prepare(`
      INSERT INTO studio_agents (id, name, role, model, endpoint, color, status, created_at, updated_at)
      VALUES (:id, :name, :role, :model, :endpoint, :color, :status, :createdAt, :updatedAt)
    `);
    for (const agent of seedAgents) {
      const now = new Date().toISOString();
      insert.run({ ...agent, createdAt: now, updatedAt: now });
    }
  }

  const scheduleCount = asRow<{ count: number }>('SELECT COUNT(*) as count FROM schedules')?.count ?? 0;
  if (scheduleCount === 0) {
    const insert = db.prepare(`
      INSERT INTO schedules (id, name, cron, timezone, job_type, status, last_run_at, next_run_at)
      VALUES (:id, :name, :cron, :timezone, :jobType, :status, :lastRunAt, :nextRunAt)
    `);
    for (const schedule of seedSchedules) {
      insert.run(schedule);
    }
  }

  const memoryCount = asRow<{ count: number }>('SELECT COUNT(*) as count FROM memory_entries')?.count ?? 0;
  if (memoryCount === 0) {
    const insert = db.prepare(`
      INSERT INTO memory_entries (id, scope, kind, title, content, created_at)
      VALUES (:id, :scope, :kind, :title, :content, :createdAt)
    `);
    for (const entry of seedMemory) {
      insert.run(entry);
    }
  }
}

seedIfEmpty();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapRun(row: {
  id: string;
  session_id: string;
  goal: string;
  agent_name: string | null;
  state: string;
  model: string;
  started_at: string;
  finished_at: string | null;
}): AgentRun {
  return {
    id: row.id,
    sessionId: row.session_id,
    goal: row.goal,
    agentName: row.agent_name,
    state: row.state as AgentRun['state'],
    model: row.model,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

function mapToolCall(row: {
  id: string;
  run_id: string;
  agent_name: string;
  tool_name: string;
  input: string;
  output: string;
  status: string;
  started_at: string;
  finished_at: string | null;
}): ToolCall {
  return {
    id: row.id,
    runId: row.run_id,
    agentName: row.agent_name,
    toolName: row.tool_name,
    input: row.input,
    output: row.output,
    status: row.status as ToolCall['status'],
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

function mapMessage(row: {
  id: string;
  session_id: string;
  run_id: string;
  from_agent: string;
  to_agent: string;
  role: string;
  content: string;
  created_at: string;
}): AgentMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    runId: row.run_id,
    fromAgent: row.from_agent,
    toAgent: row.to_agent,
    role: row.role as AgentMessage['role'],
    content: row.content,
    createdAt: row.created_at,
  };
}

function mapEvent(row: {
  id: string;
  run_id: string;
  session_id: string;
  type: string;
  agent_name: string | null;
  payload: string;
  created_at: string;
}): StudioEvent {
  return {
    id: row.id,
    runId: row.run_id,
    sessionId: row.session_id,
    type: row.type,
    agentName: row.agent_name,
    payload: row.payload,
    createdAt: row.created_at,
  };
}

function mapArtifact(row: {
  id: string;
  run_id: string;
  name: string;
  path: string;
  kind: string;
  created_at: string;
}): Artifact {
  return {
    id: row.id,
    runId: row.run_id,
    name: row.name,
    path: row.path,
    kind: row.kind,
    createdAt: row.created_at,
  };
}

function mapSchedule(row: {
  id: string;
  name: string;
  cron: string;
  timezone: string;
  job_type: string;
  status: string;
  last_run_at: string | null;
  next_run_at: string | null;
}): Schedule {
  return {
    id: row.id,
    name: row.name,
    cron: row.cron,
    timezone: row.timezone,
    jobType: row.job_type,
    status: row.status as Schedule['status'],
    lastRunAt: row.last_run_at,
    nextRunAt: row.next_run_at,
  };
}

function mapMemory(row: {
  id: string;
  scope: string;
  kind: string;
  title: string;
  content: string;
  created_at: string;
}): MemoryEntry {
  return {
    id: row.id,
    scope: row.scope,
    kind: row.kind as MemoryEntry['kind'],
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
  };
}

function persistEvent(input: Omit<StudioEvent, 'id' | 'createdAt'>) {
  const event: StudioEvent = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
  };

  db.prepare(`
    INSERT INTO events (id, run_id, session_id, type, agent_name, payload, created_at)
    VALUES (:id, :runId, :sessionId, :type, :agentName, :payload, :createdAt)
  `).run(event as unknown as SqlParams);

  studioEvents.emit('event', event);
  return event;
}

function persistMessage(message: Omit<AgentMessage, 'id' | 'createdAt'>) {
  const entry: AgentMessage = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...message,
  };

  db.prepare(`
    INSERT INTO agent_messages (id, session_id, run_id, from_agent, to_agent, role, content, created_at)
    VALUES (:id, :sessionId, :runId, :fromAgent, :toAgent, :role, :content, :createdAt)
  `).run(entry as unknown as SqlParams);

  return entry;
}

function persistToolCall(input: Omit<ToolCall, 'id'>) {
  const entry = { id: randomUUID(), ...input };
  db.prepare(`
    INSERT INTO tool_calls (id, run_id, agent_name, tool_name, input, output, status, started_at, finished_at)
    VALUES (:id, :runId, :agentName, :toolName, :input, :output, :status, :startedAt, :finishedAt)
  `).run(entry);
  return entry;
}

function persistArtifact(input: Omit<Artifact, 'id' | 'createdAt'>) {
  const artifact: Artifact = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
  };

  db.prepare(`
    INSERT INTO artifacts (id, run_id, name, path, kind, created_at)
    VALUES (:id, :runId, :name, :path, :kind, :createdAt)
  `).run(artifact as unknown as SqlParams);

  return artifact;
}

function setActiveAgent(agentName: string | null) {
  const updatedAt = new Date().toISOString();
  if (agentName === null) {
    db.prepare('UPDATE studio_agents SET status = :status, updated_at = :updatedAt').run({
      status: 'idle',
      updatedAt,
    });
    return;
  }

  db.prepare(`
    UPDATE studio_agents
    SET status = CASE WHEN name = :agentName THEN 'active' ELSE 'waiting' END,
        updated_at = :updatedAt
  `).run({
    agentName,
    updatedAt,
  });
}

export function onStudioEvent(listener: (event: StudioEvent) => void) {
  studioEvents.on('event', listener);
  return () => studioEvents.off('event', listener);
}

export function getStudioBootstrap(): StudioBootstrap {
  const runs = asRows<{
    id: string;
    session_id: string;
    goal: string;
    agent_name: string | null;
    state: string;
    model: string;
    started_at: string;
    finished_at: string | null;
  }>('SELECT * FROM runs ORDER BY started_at DESC LIMIT 8').map(mapRun);

  return {
    overview: {
      activeRunCount: asRow<{ count: number }>("SELECT COUNT(*) as count FROM runs WHERE state = 'running'")?.count ?? 0,
      totalRunCount: asRow<{ count: number }>('SELECT COUNT(*) as count FROM runs')?.count ?? 0,
      eventCount: asRow<{ count: number }>('SELECT COUNT(*) as count FROM events')?.count ?? 0,
      artifactCount: asRow<{ count: number }>('SELECT COUNT(*) as count FROM artifacts')?.count ?? 0,
      scheduleCount: asRow<{ count: number }>('SELECT COUNT(*) as count FROM schedules')?.count ?? 0,
      memoryCount: asRow<{ count: number }>('SELECT COUNT(*) as count FROM memory_entries')?.count ?? 0,
    },
    agents: asRows<{
      id: string;
      name: string;
      role: string;
      model: string;
      endpoint: string;
      color: string;
      status: string;
    }>('SELECT id, name, role, model, endpoint, color, status FROM studio_agents ORDER BY name').map((row) => ({
      ...row,
      name: row.name as StudioAgent['name'],
      status: row.status as StudioAgent['status'],
    })),
    runs,
    toolCalls: asRows<{
      id: string;
      run_id: string;
      agent_name: string;
      tool_name: string;
      input: string;
      output: string;
      status: string;
      started_at: string;
      finished_at: string | null;
    }>('SELECT * FROM tool_calls ORDER BY started_at DESC LIMIT 20').map(mapToolCall),
    messages: asRows<{
      id: string;
      session_id: string;
      run_id: string;
      from_agent: string;
      to_agent: string;
      role: string;
      content: string;
      created_at: string;
    }>('SELECT * FROM agent_messages ORDER BY created_at DESC LIMIT 20').map(mapMessage),
    events: asRows<{
      id: string;
      run_id: string;
      session_id: string;
      type: string;
      agent_name: string | null;
      payload: string;
      created_at: string;
    }>('SELECT * FROM events ORDER BY created_at DESC LIMIT 40').map(mapEvent),
    artifacts: asRows<{
      id: string;
      run_id: string;
      name: string;
      path: string;
      kind: string;
      created_at: string;
    }>('SELECT * FROM artifacts ORDER BY created_at DESC LIMIT 12').map(mapArtifact),
    schedules: asRows<{
      id: string;
      name: string;
      cron: string;
      timezone: string;
      job_type: string;
      status: string;
      last_run_at: string | null;
      next_run_at: string | null;
    }>('SELECT * FROM schedules ORDER BY name').map(mapSchedule),
    memory: asRows<{
      id: string;
      scope: string;
      kind: string;
      title: string;
      content: string;
      created_at: string;
    }>('SELECT * FROM memory_entries ORDER BY created_at DESC LIMIT 12').map(mapMemory),
    tools: [...defaultTools],
  };
}

export function listRuns() {
  return asRows<{
    id: string;
    session_id: string;
    goal: string;
    agent_name: string | null;
    state: string;
    model: string;
    started_at: string;
    finished_at: string | null;
  }>('SELECT * FROM runs ORDER BY started_at DESC').map(mapRun);
}

export function getRun(runId: string) {
  const runRow = asRow<{
    id: string;
    session_id: string;
    goal: string;
    agent_name: string | null;
    state: string;
    model: string;
    started_at: string;
    finished_at: string | null;
  }>('SELECT * FROM runs WHERE id = :runId', { runId });

  if (!runRow) {
    return null;
  }

  return {
    run: mapRun(runRow),
    toolCalls: asRows<{
      id: string;
      run_id: string;
      agent_name: string;
      tool_name: string;
      input: string;
      output: string;
      status: string;
      started_at: string;
      finished_at: string | null;
    }>('SELECT * FROM tool_calls WHERE run_id = :runId ORDER BY started_at DESC', { runId }).map(mapToolCall),
    messages: asRows<{
      id: string;
      session_id: string;
      run_id: string;
      from_agent: string;
      to_agent: string;
      role: string;
      content: string;
      created_at: string;
    }>('SELECT * FROM agent_messages WHERE run_id = :runId ORDER BY created_at DESC', { runId }).map(mapMessage),
    events: asRows<{
      id: string;
      run_id: string;
      session_id: string;
      type: string;
      agent_name: string | null;
      payload: string;
      created_at: string;
    }>('SELECT * FROM events WHERE run_id = :runId ORDER BY created_at DESC', { runId }).map(mapEvent),
    artifacts: asRows<{
      id: string;
      run_id: string;
      name: string;
      path: string;
      kind: string;
      created_at: string;
    }>('SELECT * FROM artifacts WHERE run_id = :runId ORDER BY created_at DESC', { runId }).map(mapArtifact),
  };
}

export function listRunEvents(runId: string) {
  return asRows<{
    id: string;
    run_id: string;
    session_id: string;
    type: string;
    agent_name: string | null;
    payload: string;
    created_at: string;
  }>('SELECT * FROM events WHERE run_id = :runId ORDER BY created_at ASC', { runId }).map(mapEvent);
}

export function listSchedules() {
  return asRows<{
    id: string;
    name: string;
    cron: string;
    timezone: string;
    job_type: string;
    status: string;
    last_run_at: string | null;
    next_run_at: string | null;
  }>('SELECT * FROM schedules ORDER BY name').map(mapSchedule);
}

export function updateSchedule(scheduleId: string, updates: Partial<Pick<Schedule, 'status' | 'cron' | 'timezone'>>) {
  const current = asRow<{
    id: string;
    cron: string;
    timezone: string;
    status: string;
  }>('SELECT id, cron, timezone, status FROM schedules WHERE id = :scheduleId', { scheduleId });

  if (!current) {
    return null;
  }

  db.prepare(`
    UPDATE schedules
    SET cron = :cron, timezone = :timezone, status = :status
    WHERE id = :scheduleId
  `).run({
    scheduleId,
    cron: updates.cron ?? current.cron,
    timezone: updates.timezone ?? current.timezone,
    status: updates.status ?? current.status,
  });

  return listSchedules().find((schedule) => schedule.id === scheduleId) ?? null;
}

export function runScheduleNow(scheduleId: string) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE schedules
    SET last_run_at = :now, next_run_at = :nextRunAt
    WHERE id = :scheduleId
  `).run({
    scheduleId,
    now,
    nextRunAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });

  const schedule = listSchedules().find((entry) => entry.id === scheduleId) ?? null;
  if (schedule) {
    persistEvent({
      runId: `schedule:${schedule.id}`,
      sessionId: `schedule:${schedule.id}`,
      type: 'scheduler.run',
      agentName: 'Orchestrator',
      payload: `${schedule.name} executed manually.`,
    });
  }

  return schedule;
}

export function searchMemory(query: string) {
  const normalized = `%${query.toLowerCase()}%`;
  return asRows<{
    id: string;
    scope: string;
    kind: string;
    title: string;
    content: string;
    created_at: string;
  }>(
    `
      SELECT * FROM memory_entries
      WHERE lower(title) LIKE :normalized OR lower(content) LIKE :normalized
      ORDER BY created_at DESC
      LIMIT 20
    `,
    { normalized }
  ).map(mapMemory);
}

export function createMemoryEntry(kind: MemoryEntry['kind'], title: string, content: string, scope = 'project') {
  const entry = {
    id: randomUUID(),
    scope,
    kind,
    title,
    content,
    createdAt: new Date().toISOString(),
  };

  db.prepare(`
    INSERT INTO memory_entries (id, scope, kind, title, content, created_at)
    VALUES (:id, :scope, :kind, :title, :content, :createdAt)
  `).run(entry);

  return entry;
}

async function simulateRun(runId: string, sessionId: string, goal: string) {
  const sequence = [
    ['Orchestrator', 'Planner', 'list_files', 'Scan workspace structure and identify orchestration boundaries.', 'Workspace contains client/, server/, docs/, artifacts/, logs/, workspace/.', `Break down the goal into runtime, UI, scheduler, and memory tracks for "${goal}".`, null, null],
    ['Planner', 'Researcher', 'search_code', 'Identify existing route, websocket, and dashboard modules.', 'Found server routes, websocket transport, and a dashboard shell that can host Swarm Studio.', 'Create a delivery plan with backend runtime, event store, run inspector, and workspace panels.', { name: 'run-plan.md', path: 'server/artifacts/run-plan.md', kind: 'plan' }, { kind: 'decision' as const, title: 'Run plan', content: 'Planner decomposed the run into backend, frontend, memory, and scheduler tracks.' }],
    ['Researcher', 'Coder', 'web_lookup', 'Review OpenAI-compatible local endpoint requirements and event-driven orchestration patterns.', 'OpenAI-compatible chat/completions transport and websocket event fanout fit the local runtime target.', 'Use an OpenAI-compatible endpoint abstraction with per-agent model selection and event streaming.', null, { kind: 'fact' as const, title: 'Provider requirement', content: 'Local providers must expose an OpenAI-compatible API surface.' }],
    ['Coder', 'Reviewer', 'write_file', 'Create runtime service, SQLite schema, and new Studio UI.', 'Runtime scaffolding, API surface, and visual Studio shell prepared for review.', 'Implementation complete for runtime service, event store, and live studio workspace.', { name: 'runtime-draft.ts', path: 'server/workspace/runtime-draft.ts', kind: 'source' }, { kind: 'artifact' as const, title: 'Runtime scaffold', content: 'The coder generated the first runtime and UI scaffold for Swarm Studio.' }],
    ['Reviewer', 'Tester', 'git_diff', 'Review changed files for regressions and missing structure.', 'Key risks: event schema drift, missing cancellation flow, UI not highlighting active agent.', 'Request validation of websocket events, run detail queries, and schedule controls.', null, { kind: 'failure' as const, title: 'Review risk', content: 'Reviewer flagged run cancellation and UI active-state coverage as validation points.' }],
    ['Tester', 'File Manager', 'run_tests', 'Build server and client type layers and inspect generated outputs.', 'Type-level validation and build checks executed for runtime and UI wiring.', 'Validation completed; package builds reflect the new Studio foundation.', { name: 'validation-report.txt', path: 'server/logs/validation-report.txt', kind: 'log' }, { kind: 'fact' as const, title: 'Validation note', content: 'Tester completed build-level validation for the Studio foundation.' }],
    ['File Manager', 'Orchestrator', 'write_file', 'Persist trace summary, artifact index, and workspace outputs.', 'Artifacts indexed and workspace outputs exposed to the run inspector.', 'Artifacts stored and run can be marked complete.', { name: 'artifact-index.json', path: 'server/artifacts/artifact-index.json', kind: 'artifact-index' }, { kind: 'artifact' as const, title: 'Artifact index', content: 'File Manager stored generated artifacts and exposed them to the workspace panel.' }],
  ] as const;

  for (const step of sequence) {
    const current = getRun(runId)?.run;
    if (!current || current.state === 'cancelled') {
      setActiveAgent(null);
      return;
    }

    const [agentName, nextAgent, toolName, toolInput, toolOutput, messageText, artifact, memory] = step;
    setActiveAgent(agentName);
    db.prepare('UPDATE runs SET state = :state, agent_name = :agentName WHERE id = :runId').run({
      state: 'running',
      agentName,
      runId,
    });

    persistEvent({ runId, sessionId, type: 'agent.started', agentName, payload: `${agentName} is active.` });
    const message = persistMessage({
      sessionId,
      runId,
      fromAgent: agentName,
      toAgent: nextAgent,
      role: 'handoff',
      content: messageText,
    });
    persistEvent({
      runId,
      sessionId,
      type: 'agent.message',
      agentName,
      payload: `${message.fromAgent} -> ${message.toAgent}: ${message.content}`,
    });
    persistEvent({ runId, sessionId, type: 'tool.called', agentName, payload: `${toolName}: ${toolInput}` });
    await sleep(180);

    persistToolCall({
      runId,
      agentName,
      toolName,
      input: toolInput,
      output: toolOutput,
      status: 'completed',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    });
    persistEvent({ runId, sessionId, type: 'tool.completed', agentName, payload: `${toolName} completed.` });

    if (artifact) {
      const created = persistArtifact({ runId, ...artifact });
      persistEvent({
        runId,
        sessionId,
        type: 'task.completed',
        agentName,
        payload: `${created.name} created at ${created.path}.`,
      });
    }

    if (memory) {
      createMemoryEntry(memory.kind, memory.title, memory.content);
      persistEvent({
        runId,
        sessionId,
        type: 'memory.written',
        agentName,
        payload: `${memory.kind} stored: ${memory.title}`,
      });
    }

    await sleep(220);
  }

  db.prepare(`
    UPDATE runs
    SET state = 'completed', finished_at = :finishedAt, agent_name = :agentName
    WHERE id = :runId
  `).run({
    runId,
    finishedAt: new Date().toISOString(),
    agentName: 'Orchestrator',
  });
  setActiveAgent(null);
  persistEvent({
    runId,
    sessionId,
    type: 'run.finished',
    agentName: 'Orchestrator',
    payload: 'Run finished successfully.',
  });
}

export function createRun(goal: string) {
  const runId = randomUUID();
  const sessionId = randomUUID();
  const startedAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO runs (id, session_id, goal, agent_name, state, model, started_at, finished_at)
    VALUES (:id, :sessionId, :goal, :agentName, :state, :model, :startedAt, NULL)
  `).run({
    id: runId,
    sessionId,
    goal,
    agentName: 'Orchestrator',
    state: 'queued',
    model: 'gpt-4.1',
    startedAt,
  });

  persistEvent({
    runId,
    sessionId,
    type: 'run.created',
    agentName: 'Orchestrator',
    payload: goal,
  });
  void simulateRun(runId, sessionId, goal);
  return getRun(runId);
}

export function cancelRun(runId: string) {
  const existing = getRun(runId);
  if (!existing) {
    return null;
  }

  db.prepare('UPDATE runs SET state = :state, finished_at = :finishedAt WHERE id = :runId').run({
    runId,
    state: 'cancelled',
    finishedAt: new Date().toISOString(),
  });
  setActiveAgent(null);
  persistEvent({
    runId,
    sessionId: existing.run.sessionId,
    type: 'run.failed',
    agentName: existing.run.agentName,
    payload: 'Run cancelled by user.',
  });
  return getRun(runId);
}
