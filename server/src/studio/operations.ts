import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { getStudioDb } from './db.js';
import type { StudioBootstrap, StudioAgent } from './types.js';
import { 
  studioRunQueries, 
  studioEventQueries, 
  studioToolCallQueries, 
  studioMessageQueries, 
  studioArtifactQueries, 
  studioScheduleQueries, 
  studioMemoryQueries 
} from './queries.js';
import { 
  mapDataRunToAgentRun,
  mapDataEventToStudioEvent,
  mapDataScheduleToSchedule,
  mapDataMemoryToMemoryEntry,
  mapDataRunToDto,
  mapDataEventToDto,
  mapDataScheduleToDto,
  mapDataMemoryToDto,
  mapDataScheduleHistoryToDto,
  type StudioDataRunRow,
  type StudioDataEventRow,
} from './data-mappers.js';

const db = getStudioDb();
const studioEvents = new EventEmitter();

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

export async function simulateRun(runId: string, sessionId: string, goal: string) {
  const sequence: [string, string, string, string, string, string, object | null, object | null][] = [
    ['Orchestrator', 'Planner', 'list_files', 'Scan workspace structure and identify orchestration boundaries.', 'Workspace contains client/, server/, docs/, artifacts/, logs/, workspace/.', `Break down the goal into runtime, UI, scheduler, and memory tracks for "${goal}".`, null, null],
    ['Planner', 'Researcher', 'search_code', 'Identify existing route, websocket, and dashboard modules.', 'Found server routes, websocket transport, and a dashboard shell that can host Swarm Studio.', 'Create a delivery plan with backend runtime, event store, run inspector, and workspace panels.', { name: 'run-plan.md', path: 'server/artifacts/run-plan.md', kind: 'plan' }, { kind: 'decision' as const, title: 'Run plan', content: 'Planner decomposed the run into backend, frontend, memory, and scheduler tracks.' }],
    ['Researcher', 'Coder', 'web_lookup', 'Review OpenAI-compatible local endpoint requirements and event-driven orchestration patterns.', 'OpenAI-compatible chat/completions transport and websocket event fanout fit the local runtime target.', 'Use an OpenAI-compatible endpoint abstraction with per-agent model selection and event streaming.', null, { kind: 'fact' as const, title: 'Provider requirement', content: 'Local providers must expose an OpenAI-compatible API surface.' }],
    ['Coder', 'Reviewer', 'write_file', 'Create runtime service, SQLite schema, and new Studio UI.', 'Runtime scaffolding, API surface, and visual Studio shell prepared for review.', 'Implementation complete for runtime service, event store, and live studio workspace.', { name: 'runtime-draft.ts', path: 'server/workspace/runtime-draft.ts', kind: 'source' }, { kind: 'artifact' as const, title: 'Runtime scaffold', content: 'The coder generated the first runtime and UI scaffold for Swarm Studio.' }],
    ['Reviewer', 'Tester', 'git_diff', 'Review changed files for regressions and missing structure.', 'Key risks: event schema drift, missing cancellation flow, UI not highlighting active agent.', 'Request validation of websocket events, run detail queries, and schedule controls.', null, { kind: 'failure' as const, title: 'Review risk', content: 'Reviewer flagged run cancellation and UI active-state coverage as validation points.' }],
    ['Tester', 'File Manager', 'run_tests', 'Build server and client type layers and inspect generated outputs.', 'Type-level validation and build checks executed for runtime and UI wiring.', 'Validation completed; package builds reflect the new Studio foundation.', { name: 'validation-report.txt', path: 'server/logs/validation-report.txt', kind: 'log' }, { kind: 'fact' as const, title: 'Validation note', content: 'Tester completed build-level validation for the Studio foundation.' }],
    ['File Manager', 'Orchestrator', 'write_file', 'Persist trace summary, artifact index, and workspace outputs.', 'Artifacts indexed and workspace outputs exposed to the run inspector.', 'Artifacts stored and run can be marked complete.', { name: 'artifact-index.json', path: 'server/artifacts/artifact-index.json', kind: 'artifact-index' }, { kind: 'artifact' as const, title: 'Artifact index', content: 'File Manager stored generated artifacts and exposed them to the workspace panel.' }],
  ];

  for (const [agentName, nextAgent, toolName, toolInput, toolOutput, messageText, artifact, memory] of sequence) {
    // Check if run was cancelled
    const currentRun = await getRun(runId);
    if (!currentRun || currentRun.run.state === 'cancelled') {
      setActiveAgent(null);
      return;
    }

    // Change agent state
    setActiveAgent(agentName);
    studioRunQueries.updateState(runId, 'running');

    // Emit events
    studioEventQueries.create({ run_id: runId, session_id: sessionId, type: 'agent.started', agent_name: agentName, payload: `${agentName} is active.` });

    // Process message
    const message = await createMessage(sessionId, runId, agentName, nextAgent, 'handoff', messageText);
    studioEventQueries.create({ 
      run_id: runId, 
      session_id: sessionId, 
      type: 'agent.message', 
      agent_name: agentName, 
      payload: `${message.fromAgent} -> ${message.toAgent}: ${message.content}`
    });

    // Process tool call
    studioEventQueries.create({ run_id: runId, session_id: sessionId, type: 'tool.called', agent_name: agentName, payload: `${toolName}: ${toolInput}` });
    await new Promise(resolve => setTimeout(resolve, 180));

    createToolCall(runId, agentName, toolName, toolInput, toolOutput, 'completed', new Date().toISOString(), new Date().toISOString());
    studioEventQueries.create({ run_id: runId, session_id: sessionId, type: 'tool.completed', agent_name: agentName, payload: `${toolName} completed.` });

    // Process artifact if any
    if (artifact) {
      const created = await createArtifact(runId, (artifact as any).name, (artifact as any).path, (artifact as any).kind);
      studioEventQueries.create({
        run_id: runId,
        session_id: sessionId,
        type: 'task.completed',
        agent_name: agentName,
        payload: `${created.name} created at ${created.path}.`,
      });
    }

    // Process memory if any
    if (memory) {
      await createMemoryEntry((memory as any).kind, (memory as any).title, (memory as any).content);
      studioEventQueries.create({
        run_id: runId,
        session_id: sessionId,
        type: 'memory.written',
        agent_name: agentName,
        payload: `${(memory as any).kind} stored: ${(memory as any).title}`,
      });
    }

    await new Promise(resolve => setTimeout(resolve, 220));
  }

  // Finalize run
  studioRunQueries.updateState(runId, 'completed', new Date().toISOString());
  setActiveAgent(null);
  studioEventQueries.create({
    run_id: runId,
    session_id: sessionId,
    type: 'run.finished',
    agent_name: 'Orchestrator',
    payload: 'Run finished successfully.',
  });
}

export function setActiveAgent(agentName: string | null) {
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

export function onStudioEvent(listener: (event: any) => void) {
  studioEvents.on('event', listener);
  return () => studioEvents.off('event', listener);
}

export async function getStudioBootstrap(): Promise<StudioBootstrap> {
  const runs = studioRunQueries.list().map(mapDataRunToAgentRun);

  return {
    overview: {
      activeRunCount: studioRunQueries.getActiveCount(),
      totalRunCount: studioRunQueries.getTotalCount(),
      eventCount: studioEventQueries.getEventCount(),
      artifactCount: studioArtifactQueries.getArtifactCount(),
      scheduleCount: studioScheduleQueries.getScheduleCount(),
      memoryCount: studioMemoryQueries.getMemoryCount(),
    },
    agents: [] as StudioAgent[], // Simplified for this refactor
    runs,
    toolCalls: [],
    messages: [],
    events: studioEventQueries.listRecent(40).map(mapDataEventToStudioEvent),
    artifacts: [],
    schedules: studioScheduleQueries.list().map(mapDataScheduleToSchedule),
    memory: studioMemoryQueries.listRecent(12).map(mapDataMemoryToMemoryEntry),
    tools: [...defaultTools],
  };
}

export async function listRuns() {
  return studioRunQueries.list().map(mapDataRunToAgentRun);
}

export async function getRun(runId: string) {
  const runRow = studioRunQueries.getById(runId);
  if (!runRow) {
    return null;
  }

  return {
    run: mapDataRunToAgentRun(runRow),
    toolCalls: [],
    messages: [],
    events: [],
    artifacts: [],
  };
}

export async function listRunEvents(runId: string) {
  return studioEventQueries.listByRunId(runId).map(mapDataEventToStudioEvent);
}

export async function listSchedules() {
  return studioScheduleQueries.list().map(mapDataScheduleToSchedule);
}

export async function createRun(goal: string) {
  const runId = randomUUID();
  const sessionId = randomUUID();
  
  studioRunQueries.create(sessionId, goal);
  studioEventQueries.create({ run_id: runId, session_id: sessionId, type: 'run.created', agent_name: 'Orchestrator', payload: goal });
  
  // Start simulation asynchronously
  void simulateRun(runId, sessionId, goal);
  return await getRun(runId);
}

// Additional helper functions

export async function createToolCall(
  runId: string,
  agentName: string,
  toolName: string,
  input: string,
  output: string,
  status: string,
  startedAt: string,
  finishedAt: string
) {
  studioToolCallQueries.create({
    run_id: runId,
    agent_name: agentName,
    tool_name: toolName,
    input,
    output,
    status,
    started_at: startedAt,
    finished_at: finishedAt
  });
}

export async function createMessage(
  sessionId: string,
  runId: string,
  fromAgent: string,
  toAgent: string,
  role: string,
  content: string
) {
  const msgId = studioMessageQueries.create({
    session_id: sessionId,
    run_id: runId,
    from_agent: fromAgent,
    to_agent: toAgent,
    role,
    content,
  });

  return { id: msgId, sessionId, runId, fromAgent, toAgent, role, content, createdAt: new Date().toISOString() };
}

export async function createArtifact(
  runId: string,
  name: string,
  path: string,
  kind: string
) {
  const artifactId = studioArtifactQueries.create({
    run_id: runId,
    name,
    path,
    kind,
  });
  
  return { id: artifactId, runId, name, path, kind, createdAt: new Date().toISOString() };
}

export async function createMemoryEntry(
  kind: string,
  title: string,
  content: string,
  scope = 'project'
) {
  const memoryId = studioMemoryQueries.create({
    scope,
    kind,
    title,
    content,
  });
  
  return { id: memoryId, scope, kind, title, content, createdAt: new Date().toISOString() };
}

export async function cancelRun(runId: string) {
  const existing = await getRun(runId);
  if (!existing) {
    return null;
  }

  studioRunQueries.updateState(runId, 'cancelled', new Date().toISOString());
  setActiveAgent(null);
  
  studioEventQueries.create({
    run_id: runId,
    session_id: existing.run.sessionId,
    type: 'run.cancelled',
    agent_name: existing.run.agentName,
    payload: 'Run cancelled by user.',
  });
  
  return await getRun(runId);
}

export async function listRunToolCalls(runId: string) {
  return studioToolCallQueries.listByRunId(runId);
}

export async function listRunMessages(runId: string) {
  return studioMessageQueries.listByRunId(runId);
}

export async function listRunArtifacts(runId: string) {
  return studioArtifactQueries.listByRunId(runId);
}

export async function searchMemory(query: string) {
  return studioMemoryQueries.search(query).map(mapDataMemoryToMemoryEntry);
}

export async function updateSchedule(scheduleId: string, updates: Partial<any>) {
  studioScheduleQueries.update(scheduleId, updates);
  return await studioScheduleQueries.getById(scheduleId);
}

export async function runScheduleNow(scheduleId: string) {
  const now = new Date().toISOString();
  studioScheduleQueries.update(scheduleId, { last_run_at: now, next_run_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() });
  
  const schedule = await studioScheduleQueries.getById(scheduleId);
  if (schedule) {
    studioEventQueries.create({
      run_id: `schedule:${schedule.id}`,
      session_id: `schedule:${schedule.id}`,
      type: 'scheduler.run',
      agent_name: 'Orchestrator',
      payload: `${schedule.name} executed manually.`,
    });
  }
  
  return schedule ? mapDataScheduleToSchedule(schedule) : null;
}
