import { Scrapper } from './scrapper';
import { Telegraf, Context as TelegrafContext, Markup, Context } from 'telegraf';
import process from 'process';
import { createHmac } from 'crypto';
import { config } from 'dotenv';
const LocalSession = require('telegraf-session-local');

declare global {
	namespace NodeJS {
		interface ProcessEnv {
			BBVA_USER: string;
			BBVA_PASSWORD: string;
			TELEGRAM_TOKEN: string;
			SECRET: string;
		}
	}
}

interface MyContext extends TelegrafContext {
	session: {
		bbvaUser?: string;
	}
}

const crypt = (text: string): string => {
	return createHmac('sha256', process.env.SECRET).update(text).digest('hex');
};

const isRightUser = (user?: string): boolean => {
	return !!user && user === crypt(process.env.BBVA_USER);
};

interface Intervals {
	[key: string]: NodeJS.Timeout;
}

const intervals: Intervals = {};

const TWELVE_HOURS = 12 * 60 * 60 * 1000;

const getCash = async (): Promise<Number> => {
	const scrapper = new Scrapper(process.env.BBVA_USER, process.env.BBVA_PASSWORD);

	return await scrapper.getAssociatedAccountCash();
};

const importConfig = () => {
	config();
};

const waitForLongTask = async <T extends any>(text: string, ctx: Context, task: Promise<T>): Promise<T> => {
	const message = await ctx.reply(text);

	let count = 0;

	const interval = setInterval(() => {
		ctx.telegram.editMessageText(message.chat.id, message.message_id, undefined, `${text}${'.'.repeat(count)}`);
		count++;
	}, 500);

	const result = await task;

	clearInterval(interval);
	ctx.telegram.deleteMessage(message.chat.id, message.message_id);

	return result;
};

const start = async () => {
	const bot = new Telegraf<MyContext>(process.env.TELEGRAM_TOKEN);
	const session = new LocalSession({ database: './session.json' });

	bot.use(session.middleware());

	bot.start((ctx) => {
		ctx.session.bbvaUser = '';
		return ctx.reply('Welcome to the bot!');
	});

	bot.command('/updates', async (ctx) => {
		if(isRightUser(ctx.session.bbvaUser) && !intervals[ctx.chat.id]) {
			intervals[ctx.chat.id] = setInterval(async() => {
				const cash = await waitForLongTask('Getting cash...', ctx, getCash());

				return ctx.reply(`Current ${cash}€`);
			}, TWELVE_HOURS);

			return await ctx.reply('Updates activated!');
		}

		return ctx.reply('What?');
	});

	bot.command('/off', (ctx) => {
		if(isRightUser(ctx.session.bbvaUser) && intervals[ctx.chat.id]) {
			clearInterval(intervals[ctx.chat.id]);
			delete intervals[ctx.chat.id];

			return ctx.reply('Updates are off!');
		}

		return ctx.reply('What?');
	});


	bot.command('/now', async (ctx) => {
		if (isRightUser(ctx.session.bbvaUser)) {
			const cash = await waitForLongTask('Getting cash...', ctx, getCash());

			return ctx.reply(`Current ${cash}€`);
		}

		return ctx.reply('What?');
	});

	bot.on('text', (ctx) => {
		const originalText = ctx.message.text;
		const text = crypt(ctx.message.text);

		if (isRightUser(text)) {
			ctx.session.bbvaUser = text;
		}

		if (isRightUser(ctx.session.bbvaUser)) {
			return ctx.reply('What do you need?',
				Markup.keyboard(['/now', '/updates'])
					.resize()
			);
		}

		return ctx.reply(`You said: ${originalText}`);

	});

	bot.launch();

	process.on('SIGINT', () => bot.stop('SIGINT'));
	process.on('SIGTERM', () => bot.stop('SIGTERM'));
};


(async () => await start())();
