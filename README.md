# 8b8t kitbot

~~The server is being sold, and~~ the stash got blew up (probably because of admin abuse), so there is no point of keep running the bot anymore :(

## Bot Setup
To setup the bot make sure to have [Nodejs](https://nodejs.org/) installed.<br> First of all open the `.env` file and add the bot password, the management and chat discord webhook, the coords of the bot respawn position.
Then open a terminal window inside the folder and run `npm i`. Once finished, run `node kitbot.js` to start the bot.<br>
To run the bot 24/7 instead of using `node kitbot.js` use `pm2 start kitbot.js`.

## Why the logger
JustLikePro asked me to add a coords logger, it was just in case something serious happened and we needed to get revenge. At one poing i think he was going to grief 0day base but he didn't.
The only time it was used was to grief TheTroll2001 illegal 2021 base, after the auth exploit argument i had with him.

### Notes:
8b8t has a 30 seconds cooldown between each tp command, and the tp lasts for 60 seconds.<br>
The server also has a 30 seconds cooldown between each `/kill` command.
