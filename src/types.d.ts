import { Context as TelegrafContext } from 'telegraf';

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

export interface MyContext extends TelegrafContext {
	session: {
		bbvaUser?: string;
	}
}

export interface Intervals {
	[key: string]: NodeJS.Timeout;
}
