import { ServerResponse } from 'http';
import { Markup, Telegraf, Context } from 'telegraf';
import RedisSession from 'telegraf-session-redis';
import { Message, Update } from 'typegram';
import { ONE_DAY } from './constants';
import IntervalHandler from './intervals';
import { debug } from './logging';
import { ApiScrapper } from './scrappers/api';
import { MyContext, MySession } from './types';
import { crypt, isRightUser } from './utils';

export default class Bot {
	private bot: Telegraf<MyContext>;
	private session: RedisSession;
	private intervalHandler: IntervalHandler;
	private scrapper: ApiScrapper;

	constructor() {
		this.bot = new Telegraf<MyContext>(process.env.TELEGRAM_TOKEN);
		this.session = new RedisSession({
			// @ts-ignore
			store: {
				url: process.env.REDIS_URL || 'redis://localhost:6379'
			},
			getSessionKey: (ctx: MyContext) => ctx.from?.id,
		});

		this.bot.use(this.session.middleware());
		this.registerCommands();
		this.intervalHandler = new IntervalHandler();

		this.scrapper = new ApiScrapper(process.env.BBVA_USER, process.env.BBVA_PASSWORD);

		setInterval(async () => {
			const intervals = await this.intervalHandler.getAllIntervals();
			
			console.log('intervals', intervals);
			console.log('Date.now()', Date.now());

			for (const interval of intervals) {
				if (interval.start < Date.now()) {
					const userId = interval.userId;

					const session = this.session.getSession(userId as unknown as Context<Update>) as MySession;
					
					console.log('session', session);
					console.log('isRightUSer', isRightUser(session?.bbvaUser));

					if (isRightUser(session?.bbvaUser)) {
						console.log('session', session);

						const cash = await this.waitForLongTask('Getting cash', userId, this.getCash());

						this.sendMessageToUser(userId, `Current ${cash}€`);

						await this.intervalHandler.removeInterval(userId);
						await this.intervalHandler.setInterval(userId, interval.start + ONE_DAY);
					}
				}
			}

		}, 1000 * 60 * 2);
	}

	private async getCash(): Promise<Number> {
		return await this.scrapper.getAssociatedAccountBalance();
	}

	private sendMessageToUser(userId: number, text: string): Promise<Message.TextMessage> {
		const message = this.bot.telegram.sendMessage(userId, text);

		return message;
	}

	private async waitForLongTask<T extends any>(text: string, userId: number, task: Promise<T>): Promise<T> {
		const message = await this.sendMessageToUser(userId, text);

		let count = 1;

		const interval = setInterval(() => {
			this.bot.telegram.editMessageText(message.chat.id, message.message_id, undefined, `${text}${'.'.repeat(count)}`);
			count++;
		}, 1000);

		const result = await task;

		clearInterval(interval);
		this.bot.telegram.deleteMessage(message.chat.id, message.message_id);

		return result;
	};

	getSecrethPath(): string {
		return this.bot.secretPathComponent();
	}

	handleUpdate(update: Update, webhookResponse?: ServerResponse): void {
		this.bot.handleUpdate(update, webhookResponse);
	}

	async initializeWebhook(url: string): Promise<void> {
		await this.bot.telegram.setWebhook(url);
		console.log('Webhook set');
	}

	async removeWebhook(): Promise<void> {
		await this.bot.telegram.deleteWebhook({ drop_pending_updates: true });
		console.log('Webhook removed');
	}

	private registerCommands() {
		this.bot.start((ctx) => {
			ctx.session = null;

			return ctx.reply('Welcome to the bot!');
		});

		this.bot.command('/updates', async (ctx) => {
			debug('/updates', ctx.message, `chatId: ${ctx.chat.id}`, `savedUser ${ctx.session?.bbvaUser}`);

			const userId = ctx.from?.id;

			if (isRightUser(ctx.session?.bbvaUser)) {
				if (await this.intervalHandler.isIntervalSet(userId)) {
					return ctx.reply('You are already subscribed to updates');
				}

				debug('/updates', ctx.message, 'Right user, setting interval...', `chatId: ${ctx.chat.id}`);

				const now = new Date();

				now.setHours(10, 30, 0, 0);
				now.setDate(now.getDate() + 1);

				await this.intervalHandler.setInterval(userId, now.getTime());

				debug('/updates', ctx.message, 'Interval set', `chatId: ${ctx.chat.id}`);

				return await ctx.reply('Updates activated! Next at: ' + now.toLocaleString('ca-ES', { timeStyle: 'long', dateStyle: 'long' }));
			}

			debug('/updates', ctx.message, 'Wrong user requested updates', `chatId: ${ctx.chat.id}`);

			return ctx.reply('What?');
		});

		this.bot.command('/off', async (ctx) => {
			debug('/off', ctx.message, `chatId: ${ctx.chat.id}`, `savedUser ${ctx.session?.bbvaUser}`);

			const userId = ctx.from?.id;

			if (isRightUser(ctx.session?.bbvaUser) && await this.intervalHandler.isIntervalSet(userId)) {
				debug('/off', ctx.message, 'Right user, removing interval...', `chatId: ${ctx.chat.id}`);

				await this.intervalHandler.removeInterval(userId);

				debug('/off', ctx.message, 'Interval removed', `chatId: ${ctx.chat.id}`);

				return await ctx.reply('Updates deactivated!');
			}

			debug('/off', ctx.message, 'Wrong user requested turn off updates', `chatId: ${ctx.chat.id}`);

			return ctx.reply('What?');
		});


		this.bot.command('/now', async (ctx) => {
			debug('/now', ctx.message, `chatId: ${ctx.chat.id}`, `savedUser ${ctx.session?.bbvaUser}`);

			if (isRightUser(ctx.session?.bbvaUser)) {
				debug('/now', ctx.message, 'Requested now data', `chatId: ${ctx.chat.id}`);

				const userId = ctx.from?.id;
				const cash = await this.waitForLongTask('Getting cash', userId, this.getCash());

				return ctx.reply(`Current ${cash}€`);
			}

			debug('/off', ctx.message, 'Wrong user requested now data', `chatId: ${ctx.chat.id}`);

			return ctx.reply('What?');
		});

		this.bot.on('text', (ctx) => {
			const originalText = ctx.message.text;
			const text = crypt(ctx.message.text);

			debug('inputText', ctx.message, `Text is: ${originalText}`, `chatId: ${ctx.chat.id}`, `savedUser ${ctx.session?.bbvaUser}`);

			if (isRightUser(text)) {
				debug('inputText', ctx.message, 'Text is right user, saving it', `chatId: ${ctx.chat.id}`);

				ctx.session = {
					bbvaUser: text
				};
			}

			if (isRightUser(ctx.session?.bbvaUser)) {
				debug('inputText', ctx.message, 'Session user is correct, sending available commands', `chatId: ${ctx.chat.id}`);

				return ctx.reply('What do you need?',
					Markup.keyboard(['/now', '/updates', '/off'])
						.resize()
				);
			}

			ctx.session = null;

			debug('inputText', ctx.message, `Text is incorrect ${originalText}`, `chatId: ${ctx.chat.id}`);

			return ctx.reply(`You said: ${originalText}`);

		});
	}
}

