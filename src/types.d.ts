import { Context as TelegrafContext } from 'telegraf';

declare global {
	namespace NodeJS {
		interface ProcessEnv {
			BBVA_USER: string;
			BBVA_PASSWORD: string;
			TELEGRAM_TOKEN: string;
			SECRET: string;
			PORT?: number;
		}
	}
}

export interface MySession {
	bbvaUser?: string;
}

export interface MyContext extends TelegrafContext {
	session: MySession | null
}
