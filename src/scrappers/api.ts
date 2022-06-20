import fetch from 'node-fetch';
import https from 'https';
import { Curl, HeaderInfo } from 'node-libcurl';

const httpsAgent = new https.Agent({ keepAlive: true });
const agent = () => httpsAgent;

type BBVAAuth = {
	authToken: string;
	customerId: string;
}

type ViewersFinancialDashboardResponse = {
	familyBalances?: [{
		balance: {
			amount: number;
		};
	}]
};

type GrantingTicketsResponse = {
	user?: {
		id: string;
	}
}

export class ApiScrapper {
	private user: string;
	private password: string;

	constructor(user: string, password: string) {
		this.user = user;
		this.password = password;
	}

	public async getAssociatedAccountBalance(): Promise<number> {
		let auth;

		try {
			auth = await this.getAuth();
		} catch (e) {
			console.log(`[getAssociatedAccountBalance] Error: ${e}`);
			return 0;
		}

		if (!auth) {
			console.log(`No auth for user ${this.user}`);

			return 0;
		}

		const { authToken, customerId } = auth;

		try {
			return await this.getBalance(authToken, customerId);
		} catch (e) {
			console.log(`[getAssociatedAccountBalance] Error: ${e}`);
			return 0;
		}
	}

	private async getBalance(authToken: string, customerId: string): Promise<number> {
		const resp = await fetch(
			`https://www.bbva.es/ASO/viewersFinancialDashboard/V01/?customer.id=${customerId}&$filter=(showPending==true)`,
			{
				headers: {
					accept: "*/*",
					"cache-control": "no-cache",
					tsec: authToken,
				},
				method: "GET",
				agent,
			}
		);

		const acc = await resp.json() as ViewersFinancialDashboardResponse;

		if (acc?.familyBalances && acc?.familyBalances.length > 0) {
			return acc.familyBalances[0].balance?.amount || 0.0;
		}

		console.log(`[getBalance] Response body: ${JSON.stringify(acc)}`);

		return 0.0;
	}

	private async getAuth(): Promise<BBVAAuth | undefined> {
		const postBody = {
			authentication: {
				consumerID: "00000031",
				authenticationType: "02",
				userID: `0019-0${this.user}`,
				authenticationData: [
					{
						authenticationData: [this.password],
						idAuthenticationData: "password"
					},
				],
			},
		};

		console.log(`[getAuth] Post body: ${JSON.stringify(postBody)}`);

		const curl = new Curl();
		const close = curl.close.bind(curl);

		curl.setOpt(Curl.option.URL, "https://servicios.bbva.es/ASO/TechArchitecture/grantingTickets/V02");
		curl.setOpt(Curl.option.POST, true);
		curl.setOpt(Curl.option.POSTFIELDS, JSON.stringify(postBody));
		curl.setOpt(Curl.option.HTTPHEADER, [
			"Authority: servicios.bbva.es",
			"Accept: application/json, text/javascript, */*; q=0.01",
			"Accept-Language: en-EN",
			"Cache-Control: no-cache",
			"Content-Language: en-EN",
			"Content-Type: application/json",
			"Origin: https://movil.bbva.es",
			"Pragma: no-cache",
			"Referer: https://movil.bbva.es/",
		]);

		const respPromise: Promise<{ body: string, headers: HeaderInfo }> = new Promise((resolve, reject) => {
			curl.on("end", (statusCode: number, body: string, headers) => {
				close();
				if (Array.isArray(headers) && headers.length > 0) {
					resolve({ body, headers: headers[0] });
				} else {
					resolve({ body, headers: {}});
				}
				console.log(`[getAuth] Response status code: ${statusCode}`);
				console.log(`[getAuth] Response body: ${body}`);
			});

			curl.on("error", (err: Error) => {
				close();
				reject(err)
				console.log(`[getAuth] Error: ${err}`);
			});
		});

		curl.perform();

		const { body, headers } = await respPromise;

		const authToken = headers["tsec"];
		const json = JSON.parse(body) as GrantingTicketsResponse;

		console.log(`[getAuth] Response body: ${JSON.stringify(json)}`);

		const customerId = json.user?.id || "";

		if (customerId && authToken) {
			return { authToken, customerId };
		}
	};
}
