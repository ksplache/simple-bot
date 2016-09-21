var restify = require('restify');
var builder = require('botbuilder');
var request = require('request-promise');
var uuid = require('uuid4');

//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create chat bot
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

var bot = new builder.UniversalBot(connector);
// var toCall = connector.listen();
server.post('/api/messages', connector.listen());

//=========================================================
// Bots Dialogs
//=========================================================

bot.dialog('/', function (session) {
    // console.log('app message');
    session.send("Hello World from Ken to ", session.userData.name);
});

server.get('/api/direct/doeverything', function(req, res) {
    startConversation()
        .then(function(data) {
            sendMessage(data.conversationId, 'Hard coded from HTTP API')
                .then(function() {
                    getMessage(data.conversationId)
                        .then(function(result) {
                            res.json({
                                status: 'ok',
                                messages: result.messages,
                                id: data.conversationId
                            })
                        })
                        .catch(function(err) {
                            res.json({
                                status: 'get messages failed',
                                error: err
                            });
                        })
                })
                .catch(function(err) {
                    res.json({
                        status: 'send message failed',
                        error: err
                    });
                })
        })
        .catch(function(err) {
            res.json({
                status: 'connect failed',
                error: err
            });
        })
});

var g_conversationId;

server.get('/api/direct/connect', function(req, res) {
    startConversation()
        .then(function(data) {
            g_conversationId = data.conversationId;
            res.json({
                status: 'connect ok',
                id: g_conversationId
            })
        })
        .catch(function(err) {
            res.json({
                status: 'connect failed',
                error: err
            });
        })
});

server.get('/api/direct/send', function(req, res) {
    var msg = 'Message from SEND API'; // req.params.msg;
    sendMessage(undefined, msg)
        .then(function(data) {
            if (data.error) {
                res.json({
                    status: 'send message failed',
                    error: data.error
                })
            } else {
                res.json({
                    status: 'send message ok',
                    id: g_conversationId
                })
            }

        })
        .catch(function(err) {
            res.json({
                status: 'send message error',
                error: err
            });
        })
});

server.get('/api/direct/get', function(req, res) {
    getMessage(undefined)
        .then(function(data) {

            res.json({
                status: 'get message ok',
                id: g_conversationId,
                messages: data.messages
            })

        })
        .catch(function(err) {
            res.json({
                status: 'get message error',
                error: err
            });
        })
});

var clientSecret = process.env.BOT_DIRECT_CHANNEL_SECRET;


function startConversation() {
    /*
     Each conversation on the Direct Line channel must be explicitly started using a POST
     to the https://directline.botframework.com/api/conversations endpoint.
     If the call was authorized with a token, the conversation ID is the conversation ID in the scoped token.
     If a secret was used to start the conversation, the conversation will be started with a new, random ID.
     */
    var options = {
        method: 'POST',
        json: true,
        uri: 'https://directline.botframework.com/api/conversations',
        headers: {
            // POST /api/tokens/conversation
            Authorization: 'BotConnector ' + clientSecret
        }
    };

    return request(options);
}

function sendMessage(convId, msg) {
    if (!convId) {
        convId = g_conversationId;
    }
    /*
     The client may send messages to the bot by calling POST on
     https://directline.botframework.com/api/conversations/{conversationId}/messages.
     */
    var options = {
        method: 'POST',
        json: true,
        uri: 'https://directline.botframework.com/api/conversations/' + convId + '/messages',
        headers: {
            // POST /api/tokens/conversation
            Authorization: 'BotConnector ' + clientSecret
        },
        body: {
            "id": uuid(),
            "conversationId": convId,
            "created": new Date().toISOString(),
            "from": "Direct Line from Stanton App",
            "text": msg,
            "channelData": {}
        }
    };

    return request(options);
}

function getMessage(convId) {
    if (!convId) {
        convId = g_conversationId;
    }
    /*
     The client may retrieve messages sent by the bot by calling GET on
     https://directline.botframework.com/api/conversations/{conversationId}/messages.
     The JSON structure returned contains a watermark that can be sent on subsequent requests to skip old messages.
     The Direct Line API does not store messages indefinitely. Your client application must pick
     them up quickly before they are deleted.
     */
    var options = {
        method: 'GET',
        json: true,
        uri: 'https://directline.botframework.com/api/conversations/' + convId + '/messages',
        headers: {
            // POST /api/tokens/conversation
            Authorization: 'BotConnector ' + clientSecret
        }
    };

    return request(options);
}

