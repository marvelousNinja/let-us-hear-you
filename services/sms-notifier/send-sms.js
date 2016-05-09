var request = require('request');
var Cloudant = require('cloudant');

function main(params) {
  if (params.type !== 'emotion_report') {
    return;
  }

  request({
    url: params.twilio_url + '/Accounts/' + params.twilio_sid + '/Messages.json',
    method: 'POST',
    form: {
      From: params.twilio_phone_number,
      To: params.manager_phone_number,
      Body: 'Negative feedback detected: ' + params.feedback_id
    },
    auth: {
      username: params.twilio_sid,
      password: params.twilio_access_key
    }
  }, function(error, response) {
    if (error) {
      return whisk.done({ error: error });
    }

    console.log(response);

    Cloudant(params.cloudant_url).use(params.cloudant_db).insert({
      type: 'sms_notification',
      timestamp: +Date.now(),
      feedback_id: params.feedback_id
    }, function(error, response) {
      if (error) {
        return whisk.done({ error: error });
      }

      console.log(response);
    });

    return whisk.done();
  });

  return whisk.async();
}
