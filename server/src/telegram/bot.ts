import { Telegraf, Scenes, session, Markup } from 'telegraf';
import { newTaskWizard } from './wizard.js';
import { getTasks, getTrees, updateTask } from '../data/store.js';

// Setup wizard scene
const stage = new Scenes.Stage<Scenes.WizardContext>([newTaskWizard as any]);

export function initBot(token: string): Telegraf<Scenes.WizardContext> {
    const bot = new Telegraf<Scenes.WizardContext>(token);

    // Middleware
    bot.use(session());
    bot.use(stage.middleware());

    // Basic Commands
    bot.start((ctx) => {
        ctx.reply(
            '🤖 Welcome to the <b>AI Orchestra Bot</b>!\n\n' +
            'Available commands:\n' +
            '/tasks - View all tasks\n' +
            '/newtask - Create a new task (Step-by-Step wizard)',
            { parse_mode: 'HTML' }
        );
    });

    bot.command('newtask', (ctx) => {
        ctx.scene.enter('new_task_wizard');
    });

    bot.command('tasks', async (ctx) => {
        const tasks = getTasks();
        const trees = getTrees();

        if (tasks.length === 0) {
            return ctx.reply('No tasks found. Use /newtask to create one.');
        }

        // Send a message for each task
        for (const task of tasks) {
            const tree = trees.find(t => t.id === task.assignedTreeId);
            const treeName = tree ? tree.name : 'Unknown Tree';

            let statusEmoji = '⚪';
            if (task.status === 'in_progress') statusEmoji = '🟡';
            if (task.status === 'review') statusEmoji = '🟠';
            if (task.status === 'done') statusEmoji = '🟢';

            const text =
                `${statusEmoji} <b>${task.title}</b>\n` +
                `Status: ${task.status}\n` +
                `Priority: ${task.priority}\n` +
                `Tree: ${treeName}\n` +
                `ID: <code>${task.id}</code>`;

            // Optional actions
            const buttons = [];
            if (task.status === 'todo' || task.status === 'backlog') {
                buttons.push(Markup.button.callback('▶️ Run', `run_${task.id}`));
            }
            if (task.status === 'review') {
                buttons.push(Markup.button.callback('✅ Approve', `approve_${task.id}`));
            }

            await ctx.reply(text, {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([buttons])
            });
        }
    });

    // Action handlers for task buttons
    bot.action(/^run_(.+)$/, async (ctx) => {
        const taskId = ctx.match[1];

        try {
            // Trigger the REST endpoint execution internally
            // Since we are inside the same Express backend, we can just fetch our own local API
            await fetch(`http://localhost:${process.env.PORT || 3001}/api/tasks/${taskId}/execute`, {
                method: 'POST'
            });
            await ctx.answerCbQuery('Task execution started!');
            await ctx.reply(`Started execution for task: ${taskId}`);
        } catch (err) {
            await ctx.answerCbQuery('Failed to start execution.');
            console.error(err);
        }
    });

    bot.action(/^approve_(.+)$/, async (ctx) => {
        const taskId = ctx.match[1];
        updateTask(taskId, { status: 'done' });
        await ctx.answerCbQuery('Task approved and marked as done!');
        await ctx.reply(`Task approved: ${taskId}`);
    });

    // Error handling
    bot.catch((err, ctx) => {
        console.error(`Ooops, encountered an error for ${ctx.updateType}`, err);
    });

    return bot;
}
