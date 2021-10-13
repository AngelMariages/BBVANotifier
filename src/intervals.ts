import Redis from 'ioredis';

const INTERVALS_KEY_PREFIX = 'intervals:';

export type Interval = {
	start: number;
	userId: number;
};

export default class IntervalHandler {
	private client: Redis.Redis;

	constructor() {
		this.client = new Redis(process.env.REDIS_URL);
	}

	public async getInterval(userId: number): Promise<number | undefined> {
		if (await this.isIntervalSet(userId)) {
			const interval = await this.client.get(`${INTERVALS_KEY_PREFIX}${userId}`);

			return parseInt(interval!, 10);
		}

		return undefined;
	}

	public async isIntervalSet(userId: number): Promise<boolean> {
		return (await this.client.exists(`${INTERVALS_KEY_PREFIX}${userId}`)) > 0;
	}

	public async setInterval(userId: number, interval: number): Promise<void> {
		await this.client.set(`${INTERVALS_KEY_PREFIX}${userId}`, interval);
	}

	public async removeInterval(userId: number) {
		await this.client.del(`${INTERVALS_KEY_PREFIX}${userId}`);
	}

	public async getAllIntervals(): Promise<Interval[]> {
		const allPromises = [];
		const keys = await this.client.keys(`${INTERVALS_KEY_PREFIX}*`);

		for (const key of keys) {
			allPromises.push((async () => {
				const interval = await this.client.get(key);

				return {
					userId: parseInt(key.replace(INTERVALS_KEY_PREFIX, ''), 10),
					start: parseInt(interval!, 10),
				};
			})());
		}

		return Promise.all(allPromises);
	}
}
