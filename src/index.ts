import { Scrapper } from './scrapper';
import { Telegraf, Context as TelegrafContext, Markup } from 'telegraf';
import process from 'process';
import { clear } from 'console';
const LocalSession = require('telegraf-session-local');

declare global {
	namespace NodeJS {
		interface ProcessEnv {
			BBVA_USER: string;
			BBVA_PASSWORD: string;
			TELEGRAM_TOKEN: string;
		}
	}
}

interface MyContext extends TelegrafContext {
	session: {
		bbvaUser: string;
	}
}

const start = async () => {
	const bot = new Telegraf<MyContext>(process.env.TELEGRAM_TOKEN);
	const session = new LocalSession({ database: './session.json' });

	bot.use(session.middleware());

	bot.start((ctx) => {
		ctx.session.bbvaUser = '';
		return ctx.reply('Welcome to the bot!');
	});

	bot.command('/updates', (ctx) => {

	})


	bot.command('/now', async (ctx) => {
		if (ctx.session.bbvaUser) {
			const message = await ctx.reply('Getting current cash...');

			let count = 0;

			const interval = setInterval(() => {
				ctx.telegram.editMessageText(message.chat.id, message.message_id, undefined, `Getting current cash${'.'.repeat(count)}`);
				count++;
			}, 500);

			const scrapper = new Scrapper(process.env.BBVA_USER, process.env.BBVA_PASSWORD);

			const cash = await scrapper.getAssociatedAccountCash();

			clearInterval(interval);
			ctx.telegram.deleteMessage(message.chat.id, message.message_id);

			return ctx.reply(`Current ${cash}€`);
		}

		return ctx.reply('What?');
	});

	bot.on('text', (ctx) => {
		const text = ctx.message.text;

		if (text === process.env.BBVA_USER) {
			ctx.session.bbvaUser = text;
		}

		if (ctx.session.bbvaUser === process.env.BBVA_USER) {
			return ctx.reply('What do you need?',
			Markup.keyboard(['/now', '/updates'])
				.resize()
			);
		}

		return ctx.reply(`You said: ${text}`);
	});

	bot.launch();

	process.on('SIGINT', () => bot.stop('SIGINT'));
	process.on('SIGTERM', () => bot.stop('SIGTERM'));
};


(async () => await start())();
