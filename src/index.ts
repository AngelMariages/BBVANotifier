import { Scrapper } from './scrapper';
import { Telegraf, Markup, Context } from 'telegraf';
import process from 'process';
import { createHmac } from 'crypto';
import { config } from 'dotenv';
import { Intervals, MyContext } from './types';
import { openSync, writeFileSync } from 'fs';

import fastify from 'fastify';

const LocalSession = require('telegraf-session-local');

const crypt = (text: string): string => {
	return createHmac('sha256', process.env.SECRET).update(text).digest('hex');
};

const isRightUser = (user?: string): boolean => {
	return !!user && user === crypt(process.env.BBVA_USER);
};

const intervals: Intervals = {};

const TWELVE_HOURS = 12 * 60 * 60 * 1000;

const getCash = async (): Promise<Number> => {
	const scrapper = new Scrapper(process.env.BBVA_USER, process.env.BBVA_PASSWORD);

	return await scrapper.getAssociatedAccountCash();
};

const importConfig = () => {
	config();
};

const fgGreen = '\x1b[32m';
const reset = '\x1b[0m';

const LOG_FILE_PATH = `${__dirname}/../logs/${Date.now()}.log`

const LOG_FILE = openSync(LOG_FILE_PATH, 'w');

const debug = (action: string, telegramMessage: object, ...content: string[]) => {
	if (process.argv[2] === '--debug') {
		const timestamp = new Date().toISOString();

		writeFileSync(LOG_FILE, `[${timestamp}] - ${action}: ${content.join(' ')} ${JSON.stringify(telegramMessage, null, 4)}\n\n`);
		console.log(`[${timestamp}] - ${fgGreen}${action}${reset}:`, ...content);
		console.dir(telegramMessage);
	}
};

const waitForLongTask = async <T extends any>(text: string, ctx: Context, task: Promise<T>): Promise<T> => {
	const message = await ctx.reply(text);

	let count = 1;

	const interval = setInterval(() => {
		ctx.telegram.editMessageText(message.chat.id, message.message_id, undefined, `${text}${'.'.repeat(count)}`);
		count++;
	}, 1000);

	const result = await task;

	clearInterval(interval);
	ctx.telegram.deleteMessage(message.chat.id, message.message_id);

	return result;
};

const getBot = async (): Promise<Telegraf<MyContext>> => {
	importConfig();

	const bot = new Telegraf<MyContext>(process.env.TELEGRAM_TOKEN);
	const session = new LocalSession({ database: './session.json' });

	bot.use(session.middleware());

	bot.start((ctx) => {
		ctx.session.bbvaUser = '';
		return ctx.reply('Welcome to the bot!');
	});

	bot.command('/updates', async (ctx) => {
		debug('/updates', ctx.message, `chatId: ${ctx.chat.id}`, `savedUser ${ctx.session.bbvaUser}`);

		if (isRightUser(ctx.session.bbvaUser)) {
			if (intervals[ctx.chat.id]) {
				return ctx.reply('You are already subscribed to updates');
			}

			debug('/updates', ctx.message, 'Right user, getting cash...', `chatId: ${ctx.chat.id}`);

			const cash = await waitForLongTask('Getting cash', ctx, getCash());

			await ctx.reply(`Current ${cash}€`);

			intervals[ctx.chat.id] = setInterval(async () => {
				const cash = await waitForLongTask('Getting cash', ctx, getCash());

				await ctx.reply(`Current ${cash}€`);
			}, TWELVE_HOURS);

			debug('/updates', ctx.message, 'Interval set', `chatId: ${ctx.chat.id}`);

			return await ctx.reply('Updates activated!');
		}

		debug('/updates', ctx.message, 'Wrong user requested updates', `chatId: ${ctx.chat.id}`);

		return ctx.reply('What?');
	});

	bot.command('/off', (ctx) => {
		debug('/off', ctx.message, `chatId: ${ctx.chat.id}`, `savedUser ${ctx.session.bbvaUser}`);

		if (isRightUser(ctx.session.bbvaUser) && intervals[ctx.chat.id]) {
			debug('/off', ctx.message, 'Turning off updates', `chatId: ${ctx.chat.id}`);

			clearInterval(intervals[ctx.chat.id]);
			delete intervals[ctx.chat.id];

			return ctx.reply('Updates are off!');
		}

		debug('/off', ctx.message, 'Wrong user requested turn off updates', `chatId: ${ctx.chat.id}`);

		return ctx.reply('What?');
	});


	bot.command('/now', async (ctx) => {
		debug('/now', ctx.message, `chatId: ${ctx.chat.id}`, `savedUser ${ctx.session.bbvaUser}`);

		if (isRightUser(ctx.session.bbvaUser)) {
			debug('/now', ctx.message, 'Requested now data', `chatId: ${ctx.chat.id}`);

			const cash = await waitForLongTask('Getting cash', ctx, getCash());

			return ctx.reply(`Current ${cash}€`);
		}

		debug('/off', ctx.message, 'Wrong user requested now data', `chatId: ${ctx.chat.id}`);

		return ctx.reply('What?');
	});

	bot.on('text', (ctx) => {
		const originalText = ctx.message.text;
		const text = crypt(ctx.message.text);

		debug('inputText', ctx.message, `Text is: ${originalText}`, `chatId: ${ctx.chat.id}`, `savedUser ${ctx.session.bbvaUser}`);

		if (isRightUser(text)) {
			debug('inputText', ctx.message, 'Text is right user, saving it', `chatId: ${ctx.chat.id}`);

			ctx.session.bbvaUser = text;
		}

		if (isRightUser(ctx.session.bbvaUser)) {
			debug('inputText', ctx.message, 'Session user is correct, sending available commands', `chatId: ${ctx.chat.id}`);

			return ctx.reply('What do you need?',
				Markup.keyboard(['/now', '/updates'])
					.resize()
			);
		}

		debug('inputText', ctx.message, `Text is incorrect ${originalText}`, `chatId: ${ctx.chat.id}`);

		return ctx.reply(`You said: ${originalText}`);

	});

	process.on('SIGINT', () => bot.stop('SIGINT'));
	process.on('SIGTERM', () => bot.stop('SIGTERM'));

	return bot;
};

const startWebHook = async (bot: Telegraf<MyContext>) => {
	const fast = fastify({ logger: true });

	fast.get('/', async (request, reply) => {
		reply.send({ hello: 'world' });
	});

	const SECRET_PATH = `/telegraf/${bot.secretPathComponent()}`

	fast.post(SECRET_PATH, (req, rep) => {
		// @ts-ignore
		bot.handleUpdate(req.body, rep.raw)
	});

	const port = process.env.PORT || 8080;
	const url = process.env.URL || 'https://bbva-notifier.herokuapp.com';

	try {
		await bot.telegram.setWebhook(`${url}${SECRET_PATH}`);
		console.log('Webhook set');

		await fast.listen(port, '0.0.0.0');
	} catch (err) {
		fast.log.error(err);
		process.exit(1);
	}

	process.on('SIGINT', () => fast.close());
	process.on('SIGTERM', () => fast.close());
};

(async () => {
	const bot = await getBot();
	await startWebHook(bot);
})();
