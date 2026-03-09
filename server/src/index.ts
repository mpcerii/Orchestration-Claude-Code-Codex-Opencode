import * as dotenv from 'dotenv';
import { createApp } from './app/createApp.js';
import { createHttpServer } from './app/createHttpServer.js';
import { createSwarmExecutionRouter } from './adapters/http/swarmExecution.routes.js';
import { createTaskExecutionRouter } from './adapters/http/taskExecution.routes.js';
import { createWebSocketServer } from './adapters/ws/createWebSocketServer.js';
import { RunEventRepository } from './db/repositories/RunEventRepository.js';
import { RunRepository } from './db/repositories/RunRepository.js';
import { ScheduleRepository } from './db/repositories/ScheduleRepository.js';
import { ScheduleRunRepository } from './db/repositories/ScheduleRunRepository.js';
import { initializeSqlite } from './db/sqlite/client.js';
import { runSqliteMigrations } from './db/sqlite/migrate.js';
import { initializeSchedulerEngine } from './core/scheduler/SchedulerEngine.js';
import { runEngine } from './core/runtime/RunEngine.js';
import { RuntimeState } from './core/runtime/RuntimeState.js';
import { startTelegramBot } from './telegram/index.js';

dotenv.config();

const sqliteDb = initializeSqlite();
runSqliteMigrations(sqliteDb);
const runtimeState = new RuntimeState();
const runRepository = new RunRepository();
const runEventRepository = new RunEventRepository();
const scheduleRepository = new ScheduleRepository();
const scheduleRunRepository = new ScheduleRunRepository();
const app = createApp();
const port = Number(process.env.PORT ?? 3001);
const server = createHttpServer(app);
const { broadcaster } = createWebSocketServer(server, runtimeState);
runEngine.configure({ runtimeState, broadcaster, runRepository, runEventRepository });
const schedulerEngine = initializeSchedulerEngine({
  taskExecutionContext: { runtimeState, broadcaster },
  swarmExecutionContext: { runtimeState, broadcaster },
  scheduleRepository,
  scheduleRunRepository,
});
schedulerEngine.start();

app.use('/api', createTaskExecutionRouter({ runtimeState, broadcaster }));
app.use('/api', createSwarmExecutionRouter({ runtimeState, broadcaster }));

const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
if (telegramToken && telegramToken !== 'your_token_here') {
  startTelegramBot(telegramToken);
}

server.listen(port, () => {
  console.log(`AI Swarm Studio server listening on http://localhost:${port}`);
});

function shutdown(): void {
  schedulerEngine.stop();
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
