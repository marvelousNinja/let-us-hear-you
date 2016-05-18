var request = require('request');
var nodefn = require('when/node');
var Cloudant = require('cloudant');

function main(params) {
  try {
    return analyze(params);
  } catch (error) {
    handleError(params, error);
  }
}

function analyze(params) {
  // TODO AS: Validations
  if ((params.type !== 'event') || (params.name !== 'TextAdded')) {
    return;
  }

  // TODO AS: Anything better than bind?
  analyzeText(params).
    then(saveEmotionReport.bind(null, params)).
    then(reportSuccess).
    catch(handleError.bind(null, params))

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

function saveEmotionReport(params, response) {
  // TODO AS: Not sure why it returns array here
  // TODO AS: Document those! It should be obvious how that data works
  var tones = response[0].body.document_tone.tone_categories[0].tones;
  var emotions = tones.reduce(function(result, tone_record) {
    result[tone_record.tone_id] = tone_record;
    return result;
  }, {});

  var database = Cloudant(params.cloudant_url).use(params.cloudant_db);
  return nodefn.call(database.insert.bind(database), {
    type: 'event',
    name: 'EmotionsAnalysed',
    aggregate_type: 'feedback',
    aggregate_id: params.aggregate_id,
    timestamp: +new Date(),
    attributes: {
      emotions: emotions
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
