var watson = require('watson-developer-cloud');
var request = require('request');
var nodefn = require('when/node');
var Cloudant = require('cloudant');

function main(params) {
  try {
    return extractText(params);
  } catch (error) {
    handleError(params, error);
  }
}

function extractText(params) {
  if ((params.type !== 'event') || (params.name !== 'AudioUploaded')) {
    return;
  }

  recognizeSpeech(params)
    .then(storeText.bind(null, params))
    .then(reportSuccess)
    .catch(handleError.bind(null, params))

  return whisk.async();
}

function recognizeSpeech(params) {
  var speechToText = watson.speech_to_text({
    username: params.speech_to_text_username,
    password: params.speech_to_text_password,
    url: params.speech_to_text_url,
    version: 'v1'
  });

  return nodefn.call(speechToText.recognize.bind(speechToText), {
    audio: request(params.attributes.path),
    // TODO AS: Support more formats or document that limitation...
    content_type: 'audio/flac'
  });
}

function storeText(params, response) {
  // TODO AS: Somehow, response is an array
  var text = response[0].results[0].alternatives[0].transcript;
  var database = Cloudant(params.cloudant_url).use(params.cloudant_db);

  return nodefn.call(database.insert.bind(database), {
    type: 'event',
    name: 'TextAdded',
    aggregate_type: 'feedback',
    aggregate_id: params.aggregate_id,
    timestamp: +new Date(),
    attributes: {
      text: text
    }
  });
}

function reportSuccess() {
  whisk.done();
}

function handleError(params, error) {
  console.log(params);
  console.log(error);
  console.log(error.stack);
  whisk.done({ error: error });
}
