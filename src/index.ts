import { Scrapper } from './scrapper';
import { Telegraf } from 'telegraf';
import process from 'process';
declare global {
	namespace NodeJS {
		interface ProcessEnv {
			USER: string;
			PASSWORD: string;
			TELEGRAM_BOT_TOKEN: string;
		}
	}
}

const start = async () => {
	// const process = nodeProcess as NodeJS.Process;

	const scrapper = new Scrapper(process.env.USER, process.env.PASSWORD);

	const cash = await scrapper.getAssociatedAccountCash();

	const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

	bot.start((ctx) => ctx.reply('Welcome!'));

	bot.launch();

	process.on('SIGINT', () => bot.stop('SIGINT'));
	process.on('SIGTERM', () => bot.stop('SIGTERM'));
};


(async () => await start())();
