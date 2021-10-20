# BBVANotifier

I needed to monitor a linked account of BBVA and the easiest solution was to build a Telegram bot for it.



## Setup
You will need to put in your `.env` file:

| KEY            | Description                                 | Default                  |
| -------------- | ------------------------------------------- | ------------------------ |
| BBVA_USER      | The BBVA user of the account                | `<none>`                 |
| BBVA_PASSWORD  | The BBVA password of the account            | `<none>`                 |
| TELEGRAM_TOKEN | Telegram bot token                          | `<none>`                 |
| URL            | Telegram webhook url                        | `https://localhost/`     |
| PORT           | Telegram webhook port                       | 8080                     |
| REDIS_URL      | Redis connection URI                        | `redis://localhost:6379` |
| SECRET         | A SHA-256 hash to crypt your keys in the DB | `<none>`                 |



## Commands

#### Register the account
When you send the correct BBVA_USER as plain text in the Telegram bot it will authenticate you in the redis database.

#### `/now`
Gets the current balance of the associated account.
> :warning: If you want to recieve the information of the main account you will need to change this: https://github.com/AngelMariages/BBVANotifier/blob/master/src/scrappers/api.ts#L45

#### `/updates`
Sets an interval for the current user to recieve updates.
The interval duration is set here: https://github.com/AngelMariages/BBVANotifier/blob/master/src/bot.ts#L51

### `/off`
Stops recieving updates.
