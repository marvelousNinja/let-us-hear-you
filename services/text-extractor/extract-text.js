var request = require('request');
var when = require('when');
var nodefn = require('when/node');
var Cloudant = require('cloudant');

function processEvent(params) {
  recognizeSpeech(params)
    .then(failUnlessOK)
    .then(insertEvent.bind(null, params))
    .then(reportSuccess)
    .catch(handleError.bind(null, params))

  return whisk.async();
}

function recognizeSpeech(params) {
  return when.promise(function(resolve, reject) {
    var audioStream = request(params.attributes.path);
    var recognitionStream = request({
      url: params.speech_to_text_url + '/v1/recognize',
      method: 'POST',
      json: true,
      auth: {
        username: params.speech_to_text_username,
        password: params.speech_to_text_password
      }
    }, function(error, response, body) {
      error ? reject(error) : resolve([response, body])
    });

    audioStream.pipe(recognitionStream);
  });
}

function insertEvent(params, response) {
  var text = response[1].results[0].alternatives[0].transcript;

  return databaseInsert(params, {
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

function ignoreEvent(params) {
  var notAnEvent = params.type !== 'event';
  var notAudioUploaded = params.name !== 'AudioUploaded';

  return notAnEvent || notAudioUploaded;
}

function failUnlessOK(response) {
  if (response[0].statusCode !== 200) {
    throw new Error(JSON.stringify(response[1]));
  }

  return response;
}

function databaseInsert(params, record) {
  var database = Cloudant(params.cloudant_url).use(params.cloudant_db);
  return nodefn.call(database.insert.bind(database), record);
}

function main(params) {
  try {
    return ignoreEvent(params) ? null : processEvent(params);
  } catch (error) {
    handleError(params, error);
    return whisk.async();
  }
}

function reportSuccess() {
  whisk.done();
}

function handleError(params, error) {
  console.log(params);
  console.log(error);
  console.log(error.stack);

  return databaseInsert(params, {
    type: 'event',
    name: 'ErrorOccurred',
    aggregate_type: 'feedback',
    aggregate_id: params.aggregate_id,
    timestamp: +new Date(),
    attributes: {
      error: error.message
    }
  })
  .catch(function() {})
  .then(function() {
    whisk.done({ error: error });
  });
}
