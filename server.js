/* global console, process */
'use strict';
var dotenv = require('dotenv');
dotenv.load({ silent: true });

var restify = require('restify');
var builder = require('botbuilder');
var request = require('request-promise');
var uuid = require('uuid4');

//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server
var server = restify.createServer();

// Ensure we don't drop data on uploads
server.pre(restify.pre.pause());

// Clean up sloppy paths like //todo//////1//
server.pre(restify.pre.sanitizePath());

// Handles annoying user agents (curl)
server.pre(restify.pre.userAgentConnection());

// Set a per request bunyan logger (with requestid filled in)
server.use(restify.requestLogger());

// Allow 5 requests/second by IP, and burst to 10
server.use(restify.throttle({
    burst: 10,
    rate: 5,
    ip: true
}));

// Use the common stuff you probably want
server.use(restify.acceptParser(server.acceptable));
server.use(restify.dateParser());
server.use(restify.authorizationParser());
server.use(restify.queryParser());
server.use(restify.gzipResponse());
server.use(restify.bodyParser());

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
    session.send("Hello World from Ken echo: " + JSON.stringify(session.message)); //.text);
});

function checkMessages(convId, expected, res) {
    var count = 0;
    var actual = 0;
    var response;
    while (actual !== expected) {
        count++;
        if (count > 10) {
            actual = expected;
            response = {
                status: 'get messages retries exceeded'
            };
        } else {
            getMessage(convId)
                .then(function (result) {
                    actual = result.messages;
                    response = {
                        status: 'ok',
                        messages: result.messages,
                        id: convId
                    };
                })
                .catch(function (err) {
                    response = {
                        status: 'get messages failed',
                        error: err
                    };
                    actual = expected; // break
                });
        }
    }

    res.json(response);
}
server.get('/api/direct/doeverything', function(req, res) {
    startConversation()
        .then(function(data) {
            sendMessage(data.conversationId, 'Hard coded from HTTP API')
                .then(function() {
                    checkMessages(data.conversationId, 2, res);
                    // getMessage(data.conversationId)
                    //     .then(function(result) {
                    //         res.json({
                    //             status: 'ok',
                    //             messages: result.messages,
                    //             id: data.conversationId
                    //         })
                    //     })
                    //     .catch(function(err) {
                    //         res.json({
                    //             status: 'get messages failed',
                    //             error: err
                    //         });
                    //     })
                })
                .catch(function(err) {
                    res.json({
                        status: 'send message failed',
                        error: err
                    });
                });
        })
        .catch(function(err) {
            res.json({
                status: 'connect failed',
                error: err
            });
        });
});

var g_conversationId;
server.get('/api/direct/ping', function(req, res) {
    res.json({
        status: 'ping ok',
        query: req.query
    });
});

server.get('/api/direct/connect', function(req, res) {
    startConversation()
        .then(function(data) {
            g_conversationId = data.conversationId;
            res.json({
                status: 'connect ok',
                id: g_conversationId
            });
        })
        .catch(function(err) {
            res.json({
                status: 'connect failed',
                error: err
            });
        });
});

server.get('/api/direct/send', function(req, res) {
    var response = {
        message: req.query.msg,
        id: req.query.id
    };
    sendMessage(req.query.id, req.query.msg)
        .then(function(data) {
            if (data.error) {
                response.status = 'send message failed';
                response.error = data.error;
                res.json(response);
            } else {
                response.status = 'send message ok';
                res.json(response);
            }
    
        })
        .catch(function(err) {
            response.status = 'send message error';
            response.error = err;
            res.json(response);
        });
});

server.get('/api/direct/get', function(req, res) {
    getMessage(req.query.id)
        .then(function(data) {
            res.json({
                status: 'get message ok',
                id: req.query.id,
                messages: data.messages
            });

        })
        .catch(function(err) {
            res.json({
                status: 'get message error',
                id: req.query.id,
                error: err
            });
        });
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
        resolveWithFullResponse: true,
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

