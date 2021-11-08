const TG = require('telegram-bot-api');
require('dotenv').config()

const api = new TG({token: process.env.TG_TOKEN})

Array.prototype.tail = function() {
    return this.splice(1, this.length - 1);
}

const commands = [
    {command: "/rate", description: "Starts a rating"},
    {command: "/results", description: "Stops a rating and shows results"},
]

let me = null;
const chats = {}

api.getMe()
    .then(_me => {
        me = _me;
        console.log(_me)
    })
    .catch(console.err);

api.setMyCommands({"commands": commands})
    .then( () => {
        api.getMyCommands()
            .then(console.log)
            .catch(console.err);
    })
    .catch(console.err);


// Define your message provider
const mp = new TG.GetUpdateMessageProvider()

// Set message provider and start API
api.setMessageProvider(mp)
api.start()
    .then(() => {
        console.log('API is started')
    })
    .catch(console.err)

function getCommand (text) {
    return text.split(" ")[0].split("@")[0];
}

function getBotName (text) {
    return text.includes("@") ? text.split("@")[1] : null;
}

function getCommandMessage (text) {
    return text.split(' ').tail().join(' ');
}

function isBotName (text) {
    const botName = getBotName(text);
    return botName == null || botName === me.username;
}

function isCommand (text) {
    if(text[0] !== '/' || !isBotName(text)) return false;

    return commands.map(c => c.command).includes(getCommand(text))
}

function getChatId(message) {
    return message.chat.id + "";
}

function handleCallbackQuery(cbQuery) {
    //  {
    //     id: string,
    //     from: {id: int, is_bot: bool, first_name: string, last_name: string, username: string, language_code: string},
    //     message: {
    //       message_id: int,
    //       from: [Object],
    //       chat: {id: int, title: string, type: string},
    //       date: int,
    //       text: string,
    //       entities: [Array],
    //       reply_markup: [Object]
    //     },
    //     chat_instance: string,
    //     data: string
    //  }
    // console.log(cbQuery)

    const chatId = getChatId(cbQuery.message);

    if(!Object.keys(chats).includes(chatId)) {
        console.log("chat not found")
        api.answerCallbackQuery({
            callback_query_id: cbQuery.id,
            text: `The rating was closed`
        })
        return;
    }

    const value = cbQuery.data | 0;

    chats[chatId].results[cbQuery.from.username] = value;

    api.answerCallbackQuery({
        callback_query_id: cbQuery.id,
        text: `You rated a "${value}"`
    })
}

function handleCommandRate(message) {
    const chatId = getChatId(message)

    if(Object.keys(chats).includes(chatId)) {
        api.sendMessage({
            chat_id: chatId,
            text: `Rating already started`,
        }).catch(console.error)
        return;
    }

    const title = getCommandMessage(message.text);

    chats[chatId] = {
        date: message.date,
        results: {},
        messageId: null,
        title
    }

    api.sendMessage({
        chat_id: chatId,
        text: `Select your rating` + (title.length > 0 ? ` for: *${title}*` : ``),
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    {text: '1', callback_data: '1'},
                    {text: '2', callback_data: '2'},
                    {text: '3', callback_data: '3'},
                    {text: '4', callback_data: '4'},
                    {text: '5', callback_data: '5'},
                ],
                [
                    {text: '6', callback_data: '6'},
                    {text: '7', callback_data: '7'},
                    {text: '8', callback_data: '8'},
                    {text: '9', callback_data: '9'},
                    {text: '10', callback_data: '10'},
                ]
            ]
        }
    })
    .then(res => {
        chats[chatId].messageId = res.message_id;
    })
    .catch(console.error)
}

function handleCommandEndRating(message) {
    const chatId = getChatId(message);

    // console.log(message)

    if(!Object.keys(chats).includes(chatId)) {
        api.sendMessage({
            chat_id: chatId,
            text: `No rating started`,
        }).catch(console.error)
        return;
    }

    const chat = chats[chatId];

    api.deleteMessage({
        chat_id: chatId,
        message_id: chat.messageId
    }).catch(console.error)

    const values = Object.values(chat.results);

    if(values.length === 0) {
        return;
    }

    const min = Math.min(...values)
    const max = Math.max(...values)
    const avg = values.reduce( (pv, cv) => pv + cv, 0) / values.length;

    const title = chat.title;

    api.sendMessage({
        chat_id: chatId,
        text: `Rating` + (title.length > 0 ? ` for *${title}*` : ``) + `
Min: ${min}
Max: ${max}
Avg: ${avg}
(by ${values.length} Person${values.length > 1 ? 's' : ''})`,
        parse_mode: 'Markdown',
    }).catch(console.error)

    delete chats[chatId];

}

// Receive messages via event callback
api.on('update', update => {
    // update object is defined at
    // https://core.telegram.org/bots/api#update

    // console.log(update)
    // console.log(update.message.entities)

    if(update.callback_query) {
        handleCallbackQuery(update.callback_query)
        return;
    }

    const chatMessage = update.message.text;

    if(!isCommand(chatMessage)) return;

    const command = getCommand(chatMessage);

    switch (command) {
        case "/rate":
            handleCommandRate(update.message);
            break;
        case "/results":
            handleCommandEndRating(update.message);
            break;
    }

})

process.on('beforeExit', () => {
    if(api)
        api.stop().catch(console.err)
})