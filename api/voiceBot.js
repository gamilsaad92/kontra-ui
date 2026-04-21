const { VoiceResponse } = require('twilio').twiml;
const dialogflow = require('@google-cloud/dialogflow');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// Dialogflow text query
async function queryDialogflow(text, sessionId) {
  const client = new dialogflow.SessionsClient();
  const sessionPath = client.projectAgentSessionPath(
    process.env.DF_PROJECT_ID,
    sessionId
  );
  const request = {
    session: sessionPath,
    queryInput: {
      text: { text, languageCode: 'en-US' }
    }
  };
  const [response] = await client.detectIntent(request);
  return response.queryResult.fulfillmentText;
}

// Initial call handler
async function handleVoice(req, res) {
  const twiml = new VoiceResponse();
  const gather = twiml.gather({
    input: 'speech',
    action: '/api/voice/query',
    method: 'POST'
  });
  gather.say('Welcome to Kontra customer care. How may I assist you today?');
  res.type('text/xml');
  res.send(twiml.toString());
}

// Process the caller query with Dialogflow
async function handleVoiceQuery(req, res) {
  const speech = req.body.SpeechResult || '';
  const sessionId = req.body.CallSid || uuidv4();
  let reply = 'Sorry, I did not understand that.';
  if (speech) {
    try {
      reply = await queryDialogflow(speech, sessionId);
    } catch (err) {
      console.error('Dialogflow error:', err);
    }
  }
  const twiml = new VoiceResponse();
  twiml.say(reply);
  twiml.hangup();
  res.type('text/xml');
  res.send(twiml.toString());
}

module.exports = { handleVoice, handleVoiceQuery };
