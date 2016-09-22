/* global console, process */
'use strict';

var dotenv = require('dotenv');
dotenv.load({ silent: true });

var request = require('request-promise');
var uuid = require('uuid4');

var clientSecret = process.env.BOT_DIRECT_CHANNEL_SECRET;
var conversationId;
var baseUrl = 'https://directline.botframework.com';
//var baseUrl = 'http://96642ca4.ngrok.io';

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
        uri: baseUrl + '/api/conversations',
        headers: {
            // POST /api/tokens/conversation
            Authorization: 'BotConnector ' + clientSecret
        }
    };

    return request(options);
}

function sendMessage(msg) {
    /*
     The client may send messages to the bot by calling POST on
     https://directline.botframework.com/api/conversations/{conversationId}/messages.
     */
    var options = {
        method: 'POST',
        resolveWithFullResponse: true,
        json: true,
        uri: baseUrl + '/api/conversations/' + conversationId + '/messages',
        headers: {
            // POST /api/tokens/conversation
            Authorization: 'BotConnector ' + clientSecret
        },
        body: {
            "id": uuid(),
            "conversationId": conversationId,
            "created": new Date().toISOString(),
            "from": "Direct Line from Stanton App",
            "text": msg,
            "channelData": {
                something: 'specific to my app'
            }
        }
    };

    return request(options);
}

function getMessage() {
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
        uri: baseUrl + '/api/conversations/' + conversationId + '/messages',
        headers: {
            // POST /api/tokens/conversation
            Authorization: 'BotConnector ' + clientSecret
        }
    };

    return request(options);
}

startConversation()
    .then(function(data) {
        console.log('Start conversation: ', JSON.stringify(data));

        conversationId = data.conversationId;
        /*
         {
         "conversationId": "string",
         "token": "string",
         "eTag": "string"
         }
         */
        return sendMessage('Simon says');
    })
    .then(function(result) {
        console.log('Send message: ', JSON.stringify(result));
/*
 {
 "error": {
 "code": "MissingProperty",
 "message": "string",
 "statusCode": 0
 }
 }
 */
        return getMessage();
    })
    .then(function(data) {
        console.log('Get message: ', JSON.stringify(data));
        var messages = data.messages;
/*
 {
 "messages": [
 {
 "id": "string",
 "conversationId": "string",
 "created": "2016-09-21T17:20:58.449Z",
 "from": "string",
 "text": "string",
 "channelData": {},
 "images": [
 "string"
 ],
 "attachments": [
 {
 "url": "string",
 "contentType": "string"
 }
 ],
 "eTag": "string"
 }
 ],
 "watermark": "string",
 "eTag": "string"
 }
 */
    })
    .catch(function(err) {
        console.log('Error: ', err);
    });
