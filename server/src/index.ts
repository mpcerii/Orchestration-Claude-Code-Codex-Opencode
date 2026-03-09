import * as dotenv from 'dotenv';
import { createApp } from './app/createApp.js';
import { createHttpServer } from './app/createHttpServer.js';
import { createSwarmExecutionRouter } from './adapters/http/swarmExecution.routes.js';
import { createTaskExecutionRouter } from './adapters/http/taskExecution.routes.js';
import { createWebSocketServer } from './adapters/ws/createWebSocketServer.js';
import { RunEventRepository } from './db/repositories/RunEventRepository.js';
import { RunRepository } from './db/repositories/RunRepository.js';
import { initializeSqlite } from './db/sqlite/client.js';
import { runSqliteMigrations } from './db/sqlite/migrate.js';
import { runEngine } from './core/runtime/RunEngine.js';
import { RuntimeState } from './core/runtime/RuntimeState.js';
import { startTelegramBot } from './telegram/index.js';

dotenv.config();

const sqliteDb = initializeSqlite();
runSqliteMigrations(sqliteDb);
const runtimeState = new RuntimeState();
const runRepository = new RunRepository();
const runEventRepository = new RunEventRepository();
const app = createApp();
const port = Number(process.env.PORT ?? 3001);
const server = createHttpServer(app);
const { broadcaster } = createWebSocketServer(server, runtimeState);
runEngine.configure({ runtimeState, broadcaster, runRepository, runEventRepository });

app.use('/api', createTaskExecutionRouter({ runtimeState, broadcaster }));
app.use('/api', createSwarmExecutionRouter({ runtimeState, broadcaster }));

const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
if (telegramToken && telegramToken !== 'your_token_here') {
  startTelegramBot(telegramToken);
}

server.listen(port, () => {
  console.log(`AI Swarm Studio server listening on http://localhost:${port}`);
});
