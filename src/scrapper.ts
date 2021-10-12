import { chromium } from 'playwright-chromium';

export class Scrapper {
	private readonly user: string;
	private readonly password: string;

	constructor(user: string, password: string) {
		this.user = user;
		this.password = password;
	}

	public async getAssociatedAccountCash(): Promise<Number> {
		const browser = await chromium.launch({
			executablePath: process.env.RASPY ? '/usr/bin/chromium-browser' : undefined,
			chromiumSandbox: false,
			args: ['--disable-setuid-sandbox'],
		});
		const context = await browser.newContext();
		const page = await context.newPage();
		await page.goto('https://bbva.es');
		await page.click('.cookiesgdpr__acceptbtn');

		await page.click('[data-component="access"] .header__actions__item__link.header__access');

		const personasIframeElement = await page.waitForSelector('#tab-personas-iframe');

		const personasIframe = await personasIframeElement.contentFrame();

		await page.waitForTimeout(500);

		await personasIframe?.focus('[data-name="user"].c-input-box');

		await page.waitForTimeout(2000);

		await page.keyboard.type(this.user);

		await page.keyboard.press('Tab');

		await page.keyboard.type(this.password);

		await personasIframe?.click('button[type="submit"]');

		await page.waitForURL(/posicion-global/);

		try {
			await page.click('#noInteresa', {
				timeout: 1500,
			})
		} catch (e) { }

		await page.click('[data-id="ownershipViewCombo"]');

		await page.click('[data-testid="c_combo_box_ver_productos_como_autorizado"]');

		await page.waitForTimeout(2000);

		const cashElement = await page.waitForSelector('[data-test-group-id="table_products_CUENTAS_ORDINARIAS_Y_DIVISA"] [data-testid="c_data_amount"]');

		const cash = await cashElement.textContent();

		await browser.close();

		const matches = cash?.match(/(\d,\d+)/)

		if (matches != null) {
			return Number.parseFloat(matches[0].replace(',', '.'));
		} else {
			return 0.0;
		}
	}
}