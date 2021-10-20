import process from 'process';
import { config as importConfig } from 'dotenv';
import fastify from 'fastify';
import Bot from './bot';

const startWebHook = async (bot: Bot) => {
	const fast = fastify({ logger: true });

	fast.get('/', async (request, reply) => {
		reply.send({ hello: 'world' });
	});

	const SECRET_PATH = `/telegraf/${bot.getSecrethPath()}`;

	fast.post(SECRET_PATH, (req, rep) => {
		// @ts-ignore
		bot.handleUpdate(req.body, rep.raw)
	});

	const port = process.env.PORT || 8080;
	const url = process.env.URL || 'http://localhost/';

	try {
		await bot.initializeWebhook(`${url}${SECRET_PATH}`);
		await fast.listen(port, '0.0.0.0');
	} catch (err) {
		fast.log.error(err);
		process.exit(1);
	}

	const close = async () => {
		console.log('\nClosing...');

		await bot.removeWebhook();

		process.exit(0);
	}

	process.on('SIGINT', () => close());
	process.on('SIGTERM', () => close());
};

(async () => {
	importConfig();

	const bot = new Bot();
	await startWebHook(bot);
})();
