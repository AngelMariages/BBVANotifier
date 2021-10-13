import { openSync, writeFileSync } from 'fs';
import { DEBUG_ACTIVE } from './utils';

const fgGreen = '\x1b[32m';
const reset = '\x1b[0m';

const LOG_FILE_PATH = `${__dirname}/../logs/${Date.now()}.log`
const LOG_FILE = openSync(LOG_FILE_PATH, 'w');

export const debug = (action: string, telegramMessage: object, ...content: string[]) => {
	if (DEBUG_ACTIVE) {
		const timestamp = new Date().toISOString();

		writeFileSync(LOG_FILE, `[${timestamp}] - ${action}: ${content.join(' ')} ${JSON.stringify(telegramMessage, null, 4)}\n\n`);
		console.log(`[${timestamp}] - ${fgGreen}${action}${reset}:`, ...content);
		console.dir(telegramMessage);
	}
};
