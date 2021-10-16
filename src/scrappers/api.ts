import fetch from 'node-fetch';

type BBVAAuth = {
	authToken: string;
	customerId: string;
}

export class ApiScrapper {
	private user: string;
	private password: string;

	private accountReady: Promise<BBVAAuth> | null = null;

	constructor(user: string, password: string) {
		this.user = user;
		this.password = password;
	}

	public async getAssociatedAccountBalance(): Promise<number> {
		const { authToken, customerId } = await this.getAuth();

		return await this.getBalance(authToken, customerId);
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

		const acc = await resp.json();

		// @ts-ignore
		if (acc && acc.familyBalances && acc.familyBalances.length > 0) {
			// @ts-ignore
			return acc.familyBalances[0].balance.amount;
		}

		return 0.0;
	}

	private async getAuth(): Promise<BBVAAuth> {
		if (!!this.accountReady) {
			return await this.accountReady;
		}

		this.accountReady = new Promise<BBVAAuth>(async (resolve) => {
			const postBody = {
				authentication: {
					consumerID: "00000001",
					authenticationType: "02",
					userID: `0019-0${this.user}`,
					authenticationData: [
						{ authenticationData: [this.password], idAuthenticationData: "password" },
					],
				},
			};

			const resp = await fetch(
				"https://www.bbva.es/ASO/TechArchitecture/grantingTickets/V02",
				{
					headers: {
						"content-type": "application/json",
					},
					body: JSON.stringify(postBody),
					method: "POST",
				}
			);

			const authToken = resp.headers.get("tsec");
			const json = await resp.json();

			// @ts-ignore
			const customerId = json.user.id;

			resolve({ authToken: authToken!, customerId });
		});

		return await this.accountReady;
	};
}
