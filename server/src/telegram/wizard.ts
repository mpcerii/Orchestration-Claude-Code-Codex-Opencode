import { Scenes, Markup } from 'telegraf';
import { getTrees, createTask } from '../data/store.js';
import type { TaskPriority } from '../types.js';

// Define the wizard steps
export const newTaskWizard = new Scenes.WizardScene<Scenes.WizardContext>(
    'new_task_wizard',
    // Step 1: Ask for title
    async (ctx) => {
        await ctx.reply('Let\'s create a new task!\n\n1. What is the <b>title</b> of the task?', { parse_mode: 'HTML' });
        (ctx.wizard as any).state = {};
        return ctx.wizard.next();
    },
    // Step 2: Receive title, ask for description
    async (ctx) => {
        if (!('text' in ctx.message!)) return;
        (ctx.wizard.state as any).title = ctx.message.text;

        await ctx.reply('2. Great. Please provide a short <b>description</b>:', { parse_mode: 'HTML' });
        return ctx.wizard.next();
    },
    // Step 3: Receive description, ask for priority
    async (ctx) => {
        if (!('text' in ctx.message!)) return;
        (ctx.wizard.state as any).description = ctx.message.text;

        await ctx.reply('3. How important is this? Choose a <b>priority</b>:', {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('🟢 Low', 'p_low'), Markup.button.callback('🟡 Medium', 'p_medium')],
                [Markup.button.callback('🟠 High', 'p_high'), Markup.button.callback('🔴 Critical', 'p_critical')]
            ])
        });
        return ctx.wizard.next();
    },
    // Step 4: Receive priority, ask for tree
    async (ctx) => {
        // We expect a callback query here
        if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
            await ctx.reply('Please click one of the priority buttons above.');
            return;
        }
        const data = ctx.callbackQuery.data;
        const priority = data.replace('p_', '') as TaskPriority;
        (ctx.wizard.state as any).priority = priority;

        // Answer cb query to clear loading state on the button
        await ctx.answerCbQuery();

        // Load available trees
        const trees = getTrees();
        if (trees.length === 0) {
            await ctx.reply('No Agent Trees found. Please create one in the web UI first.\nTask creation cancelled.');
            return ctx.scene.leave();
        }

        const buttons = trees.map(t => [Markup.button.callback(`🌳 ${t.name}`, `t_${t.id}`)]);

        await ctx.reply(`Priority set to <b>${priority}</b>.\n\n4. Which <b>Agent Tree</b> should execute this task?`, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard(buttons)
        });
        return ctx.wizard.next();
    },
    // Step 5: Receive tree, ask for prompt
    async (ctx) => {
        if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
            await ctx.reply('Please click one of the tree buttons above.');
            return;
        }
        const data = ctx.callbackQuery.data;
        const treeId = data.startsWith('t_') ? data.substring(2) : data;
        (ctx.wizard.state as any).assignedTreeId = treeId;

        await ctx.answerCbQuery();

        await ctx.reply('Tree selected!\n\n5. Finally, enter the <b>prompt</b> (the initial input for the root agents):', {
            parse_mode: 'HTML'
        });
        return ctx.wizard.next();
    },
    // Step 6: Receive prompt, finalize and save
    async (ctx) => {
        if (!('text' in ctx.message!)) return;
        (ctx.wizard.state as any).prompt = ctx.message.text;

        const state = ctx.wizard.state as any;

        const task = createTask({
            title: state.title,
            description: state.description,
            priority: state.priority,
            status: 'todo', // By default starts in 'todo'
            assignedTreeId: state.assignedTreeId,
            prompt: state.prompt
        });

        await ctx.reply(
            `✅ <b>Task Created Successfully!</b>\n\n` +
            `<b>Title:</b> ${task.title}\n` +
            `<b>Priority:</b> ${task.priority}\n` +
            `<b>Status:</b> ${task.status}\n\n` +
            `You can run it from the Kanban board or by viewing /tasks.`,
            { parse_mode: 'HTML' }
        );

        return ctx.scene.leave();
    }
);
