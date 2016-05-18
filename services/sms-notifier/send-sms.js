var request = require('request');
var nodefn = require('when/node');
var Cloudant = require('cloudant');

function main(params) {
  try {
    return sendSms(params);
  } catch (error) {
    handleError(params, error);
  }
}

function sendSms(params) {
  // TODO AS: Add some validations here
  if ((params.type !== 'event') || (params.name !== 'EmotionsAnalysed')) {
    return;
  }

  if (params.attributes.emotions.anger.score < 0.5 && params.attributes.emotions.disgust.score < 0.5) {
    return;
  }

  sendTwilioSms(params).
    then(saveNotification.bind(null, params)).
    then(reportSuccess).
    catch(handleError.bind(null, params))

  return whisk.async();
}

// TODO AS: Naming things is always a problem, meh?
function sendTwilioSms(params) {
  return nodefn.call(request, {
    url: params.twilio_url + '/Accounts/' + params.twilio_sid + '/Messages.json',
    method: 'POST',
    form: {
      From: params.twilio_phone_number,
      To: params.manager_phone_number,
      Body: 'Negative feedback detected: ' + params.aggregate_id
    },
    auth: {
      username: params.twilio_sid,
      password: params.twilio_access_key
    }
  });
}

function saveNotification(params) {
  var database = Cloudant(params.cloudant_url).use(params.cloudant_db);

  return nodefn.call(database.insert.bind(database), {
    type: 'event',
    name: 'SmsNotificationSent',
    aggregate_type: 'feedback',
    aggregate_id: params.aggregate_id,
    timestamp: +new Date(),
    attributes: {}
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
