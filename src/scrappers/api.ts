import fetch from 'node-fetch';

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
				method: "GET"
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

		const resp = await fetch(
			"https://servicios.bbva.es/ASO/TechArchitecture/grantingTickets/V02",
			{
				headers: {
					"content-type": "application/json",
					"origin": "https://movil.bbva.es",
					"referrer": "https://movil.bbva.es",
					"cache-control": "no-cache",
					"content-language": "en-EN",
					"authority": "servicios.bbva.es",
				},
				body: JSON.stringify(postBody),
				method: "POST",
			}
		);

		const authToken = resp.headers.get("tsec");
		const json = await resp.json() as GrantingTicketsResponse;

		console.log(`[getAuth] Response body: ${JSON.stringify(json)}`);

		const customerId = json.user?.id || "";

		if (customerId && authToken) {
			return { authToken, customerId };
		}
	};
}
