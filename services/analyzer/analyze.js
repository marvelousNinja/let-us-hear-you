var request = require('request');
var nodefn = require('when/node');
var Cloudant = require('cloudant');

function processEvent(params) {
  analyzeText(params)
    .then(failUnlessOK)
    .then(insertEvent.bind(null, params))
    .then(reportSuccess)
    .catch(handleError.bind(null, params))

  return whisk.async();
}

function analyzeText(params) {
  return nodefn.call(request, {
    url: params.tone_analyzer_url + '/v3/tone?version=2016-02-11&tones=emotion&sentences=false',
    method: 'POST',
    json: {
      text: params.attributes.text
    },
    auth: {
      username: params.tone_analyzer_username,
      password: params.tone_analyzer_password
    }
  });
}

function insertEvent(params, response) {
  var tones = response[1].document_tone.tone_categories[0].tones;
  var emotions = tones.reduce(function(result, tone_record) {
    result[tone_record.tone_id] = tone_record;
    return result;
  }, {});

  return databaseInsert(params, {
    type: 'event',
    name: 'EmotionsAnalyzed',
    aggregate_type: 'feedback',
    aggregate_id: params.aggregate_id,
    timestamp: +new Date(),
    attributes: {
      emotions: emotions
    }
  });
}

function ignoreEvent(params) {
  var notAnEvent = params.type !== 'event';
  var notTextAdded = params.name !== 'TextAdded';

  return notAnEvent || notTextAdded;
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
