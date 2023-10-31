const sqlite3 = require('sqlite3').verbose();
const mineflayer = require('mineflayer');
const mcData = require('minecraft-data');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const baseX = process.env.BASE_X;
const baseZ = process.env.BASE_Z;

const botName = "kitbot";

const bot = mineflayer.createBot({
    host: '8b8t.me',
    username: botName,
    auth: 'offline',
    port: 25565,
    version: `1.12.2`,
    viewDistance: 'tiny'
})

const db = new sqlite3.Database('db');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (username TEXT, value INTEGER)");
});


/*--------------  StopWatch  --------------*/

class Stopwatch {
    constructor() {
        this.startTime = 0;
    }

    start() {
        this.startTime = new Date().getTime();
    }

    stop() {
        this.startTime = 0;
    }

    set(seconds) {
        this.startTime = seconds;
    }

    getElapsedTime() {
        if (this.startTime === 0) {
            return 0;
        } else {
            return (new Date().getTime() - this.startTime) / 1000;
        }
    }
}


/*--------------  Events  --------------*/

let data = mcData.IndexedData;
let requestsQueue = [];
let cooldownMap = new Map();
let tickCounter = 0;
let tpName;
let devMode = false;
let isDelivering = false;

const tpaTimer = new Stopwatch();
const cooldownTimer = new Stopwatch();


bot.once('spawn', () => {
    cooldownTimer.set(25);

    bot.on('kicked', e => {
        chatHook("Kicked", e);
        db.close();
        bot.waitForTicks(200);
        process.exit();
    })

    bot.on('error', e => {
        chatHook("Error", e);
        db.close();
        bot.waitForTicks(200);
        process.exit();
    })

    data = mcData(bot.version);
    shulkers = data.itemsArray
        .filter((item) => /^.*_shulker_box/.test(item.name))
        .map((item) => item.name);

    bot.on('chat', (username, message) => {
        if (username === bot.username)
            return;
        if (username === `8b8t` && message === `Please, login with the command: /login <password>`) {
            bot.chat(`/login ` + process.env.BOT_PW);
            return;
        }

        if (!(username === '8b8t' && (message.toLowerCase().includes("http"))))
            chatHook(username, message);

        if (isWhitelisted(username)) {
            if (message.startsWith(`!ignore`)) {
                bot.chat("/ignore " + message.substring(`!ignore `.length).trim());
                bot.wait(50);
                bot.chat("/msg " + username + "The user got ignored!!");
            }

            if (message === `!kill`)
                bot.chat(`/kill`);

            if (message === `!restart`) {
                db.close();
                process.exit();
            }

            if (message === `!dev`) {
                devMode = !devMode;
                bot.chat(`Dev Mode! --> ` + devMode);
            }

            if (message === `!t`)
                bot.chat(tickCounter);
        }

        if (devMode) // check devmode
            return;

        if (message.startsWith(`!stats`)) {
            fs.readFile('counter.txt', 'utf8', (err, data) => {
                if (err) {
                    console.error(err);
                    bot.chat(`There was an error during that operation!`);
                }
                let counter = parseInt(data) || 0;
                bot.chat(`Delivered kits: ${counter}`);
            });
        }

        if (message.startsWith(`!queue`)) {
            bot.chat("Request queue: " + requestsQueue.toString().replace('[', '').replace(']', ''));
        }

        if (isKitCommand(message)) {
            if (tpName !== username && cooldownMap.get(username)) {
                bot.chat(`/msg ${username} You're on cooldown, try again in ${cooldownMap.get(username)} minutes!`);
            } else if (requestsQueue.includes(username)) {
                bot.chat(`/msg ${username} you already requested a kit, it will arrive soon!`);
            } else if (username === tpName) {
                bot.chat(`/msg ${username} &6Do /tpy ${botName}`);
            } else {
                incrementOrSet(username, function (result) {
                    if (result) {
                        bot.chat(`/msg ${username} You ordered too many kits!!!`);
                    } else {
                        requestsQueue.push(username);
                        if (requestsQueue.length > 1)
                            bot.chat(`/msg ${username} Your kit will be delivered soon!`);
                        else if (tpaTimer.getElapsedTime() < 30 && tpaTimer.getElapsedTime() > 25) {
                            bot.chat(`/msg ${username} Wait...`);
                        } else if (tpaTimer.getElapsedTime() <= 25) {
                            bot.chat(`/msg ${username} Your kit will be delivered in less then 30 seconds!`);
                        }
                    }
                });


            }
        }
    })

    bot.on('playerLeft', (player) => {
        if (isDelivering && tpName === player) {
            isDelivering = false;
        }
    });


    bot.on('physicsTick', async () => {
        tickCounter++;

        if (tickCounter % 35 !== 0) {
            return;
        }

        if (bot.inventory.items().length !== 0
            && isDelivering
            && tpName !== undefined
            && cooldownTimer.getElapsedTime() > 30
            && !((bot.entity.position.x > (baseX - 50) && bot.entity.position.x < (baseX + 50)) && (bot.entity.position.z > (baseZ - 50) && Math.round(bot.entity.position.z - 50) < baseZ)))
        {
            coordsHook();
            bot.waitForTicks(20);
            bot.chat("/kill");
            console.log("bot killed! - Tick");
            cooldownTimer.start();
        }

        if ((tpaTimer.getElapsedTime() > 20 && tpaTimer.getElapsedTime() < 21) || (tpaTimer.getElapsedTime() > 40 && tpaTimer.getElapsedTime() < 41) && isDelivering) {
            bot.chat(`/msg ${tpName} &6Do /tpy ${botName}`);
        }

        if (tpaTimer.getElapsedTime() > 61 && isDelivering) {
            isDelivering = false;
            tpaTimer.stop();
            bot.chat(`/msg ${tpName} You took too long to tp! 20min ban!`);
            cooldownMap.set(tpName, 20);
            cooldownTimer.set(62);
            console.log(`User ${tpName} took too long to tp`);
            tpName = undefined;
            return;
        }

        if (requestsQueue.length !== 0) {
            if (!isDelivering && requestsQueue[0] !== undefined && (tpaTimer.getElapsedTime() === 0 || tpaTimer.getElapsedTime() > 30)) {
                isDelivering = true;
                console.log(requestsQueue);
                chatHook("System", "\`\`\`Queue: " + requestsQueue + "\`\`\`");

                if (bot.inventory.items().length === 0) {
                    const chestBlock = bot.findBlock({
                        matching: data.blocksByName["trapped_chest"].id,
                        maxDistance: 5
                    });

                    if (chestBlock) {
                        /*
                        const chest = await bot.openChest(chestBlock);
                        try {
                            if (chest) {
                                const containedShulkers = bot.currentWindow.containerItems().filter(item => item.type === 220);
                                if (!containedShulkers.length) {
                                    chest.close();
                                    bot.chat(`/msg ${requestsQueue[0]} Out of kits, try again later`);
                                    isDelivering = false;
                                    return;
                                }

                                await chest.withdraw(containedShulkers[0].type, null, 1);
                                chest.close();
                            } else {
                                console.log(chest)
                                chest.close()
                                isDelivering = false
                                return;
                            }
                        } catch (e) {
                            console.log(e)
                            chest.close()
                            isDelivering = false
                            return;
                        }
                         */

                        bot.openChest(chestBlock).then(chest => {
                            if (chest) {
                                const containedShulkers = bot.currentWindow.containerItems().filter(item => item.type === 220);
                                if (!containedShulkers.length) {
                                    chest.close();
                                    bot.chat(`/msg ${requestsQueue[0]} Out of kits, try again later`);
                                    isDelivering = false;
                                } else {
                                    chest.withdraw(containedShulkers[0].type, null, 1).then(r => {
                                        chest.close();
                                        deliver();
                                    });
                                }
                            } else {
                                console.log(chest)
                                chest.close();
                                isDelivering = false;
                            }
                        })
                    } else {
                        bot.chat(`/msg ${requestsQueue[0]} Error, try again later :(`);
                        isDelivering = false;
                    }
                } else {
                    deliver();
                }
            } else if (requestsQueue[0] === undefined) {
                requestsQueue.shift();
            }
        }
    })
});

function deliver() {
    const min = 1;
    const max = 3;

    tpName = requestsQueue[0];
    bot.chat(`/tpa ${tpName}`);

    tpaTimer.start();
    console.log("Sent tpa to " + requestsQueue[0]);
    chatHook("System", "\`\`\`Sent tpa to " + requestsQueue[0] + "\`\`\`");

    if (!isWhitelisted(requestsQueue[0])) {
        cooldownMap.set(requestsQueue[0], Math.round(Math.random() * (max - min) + min));
    }
    requestsQueue.shift();
}

bot.on("forcedMove", async () => {
    if (isDelivering && cooldownTimer.getElapsedTime() > 30) {
        coordsHook();
        bot.waitForTicks(20);
        bot.chat("/kill");
        console.log("bot killed! - ForcedMove");
        cooldownTimer.start();
    }
});

bot.on('death', () => {
    console.log("dead");
    chatHook("System", "\`\`\`Dead\`\`\`");
    isDelivering = false;
    tpName = undefined;
    kitCounter();
});


/*--------------  Functions  --------------*/

function kitCounter() {
    fs.readFile('counter.txt', 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return;
        }
        let counter = parseInt(data) || 0;
        counter++;
        fs.writeFile('counter.txt', counter.toString(), 'utf8', (err) => {
            if (err) {
                console.error(err);
            }
        });
    });
}

function isKitCommand(message) {
    message = message.toLowerCase().substring(1, message.length);
    const kitCommands = ["kit", "freekit"];
    return kitCommands.some(e => message.startsWith(e));
}


function isWhitelisted(username) {
    return username.toString().includes(`Ai_2473`) || username.toString().includes(`Steffie678`) || username.toString().includes(`jaxui`);
}


/*--------------  Intervals  --------------*/

setInterval(() => {
    if (requestsQueue.length < 3) {
        fs.readFile('spammer.txt', 'utf8', (err, data) => {
            if (err) {
                return console.log(err);
            }

            const lines = data.split('\n');
            const randomIndex = Math.floor(Math.random() * lines.length);
            let randomLine = lines[randomIndex];
            randomLine = randomLine.replace(/\u000D/g, '');
            bot.chat(randomLine.toString());
        });
    }
}, 120_000);

setInterval(() => {
    for (const [name, cooldown] of cooldownMap.entries()) {
        if (cooldown - 1 <= 0) {
            cooldownMap.delete(name);
            return;
        }
        cooldownMap.set(name, cooldown - 1);
    }
}, 60_000);


/*--------------  DataBase  --------------*/

function incrementOrSet(username, callback) {
    db.get("SELECT * FROM users WHERE username = ?", username, (err, row) => {
        if (err) {
            console.error("Error! " + err);
            callback(false);
        } else if (row) {
            const newValue = row.value + 1;
            db.run("UPDATE users SET value = ? WHERE username = ?", [newValue, username], (err) => {
                if (err) {
                    console.error("Error! " + err);
                } else {
                    callback(newValue > 20);
                }
            });
        } else {
            db.run("INSERT INTO users (username, value) VALUES (?, ?)", [username, 1], (err) => {
                if (err) {
                    console.error("Error! " + err);
                }
                callback(false);
            });
        }
    });
}


/*--------------  WebHooks  --------------*/

function coordsHook() {
    if (Math.abs(bot.entity.position.x) > 15_000 && Math.abs(bot.entity.position.z) > 15_000) {
        let params = {
            username: "KitBot",
            content: `${tpName} - ${bot.game.dimension} ` + ":" + ` (${Math.round(bot.entity.position.x)}, ${Math.round(bot.entity.position.z)})`,
        };

        hooker(params, process.env.HOOK_MANAGEMENT);
    }
}

function chatHook(username, message) {
    let params = {
        username: "KitBot",
        content: username + ": " + message,
    };
    hooker(params, process.env.HOOK_CHAT);
}

function hooker(data, url) {
    return axios({
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        data: JSON.stringify(data),
        url: url,
    });
}


/*--------------  Logging  --------------*/
console.error = (message) => {
    let embed = [
        {
            title: "KitBot",
            color:  9900000,
            fields: [
                {
                    name: `ERROR`,
                    value: message,
                },
            ],
        },
    ];
    hooker(embed, process.env.HOOK_CHAT); // idk if this stuff works, i never tested it
};
