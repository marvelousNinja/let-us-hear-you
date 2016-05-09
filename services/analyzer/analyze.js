var request = require('request');
var Cloudant = require('cloudant');

function main(params) {
  if (params.type !== 'text_content') {
    return;
  }

  request({
    url: params.tone_analyzer_url + '/v3/tone?version=2016-02-11&tones=emotion&sentences=false',
    method: 'POST',
    json: {
      text: params.content
    },
    auth: {
      username: params.tone_analyzer_username,
      password: params.tone_analyzer_password
    }
  }, function(error, response) {
    if (error) {
      return whisk.done({ error: error });
    } else {
      var tones = response.body.document_tone.tone_categories[0].tones;
      var emotions = tones.reduce(function(result, tone_record) {
        result[tone_record.tone_id] = tone_record;
        return result;
      }, {});

      Cloudant(params.cloudant_url).use(params.cloudant_db).insert({
        type: 'emotion_report',
        // TODO AS: Document those!
        emotions: emotions,
        feedback_id: params.feedback_id,
        timestamp: +Date.now()
      }, function(error) {
        if (error) {
          return whisk.done({ error: error });
        }

        return whisk.done();
      });
    }
  });

  return whisk.async();
}
