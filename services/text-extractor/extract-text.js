var watson = require('watson-developer-cloud');
var request = require('request');
var Cloudant = require('cloudant');

function main(params) {
  try {
    if (params.type !== 'audio_content') {
      return;
    }

    var speechToText = watson.speech_to_text({
      username: params.speech_to_text_username,
      password: params.speech_to_text_password,
      url: params.speech_to_text_url,
      version: 'v1'
    });

    var audioFile = params.path;

    speechToText.recognize({
      audio: request(audioFile),
      content_type: 'audio/flac'
    }, function(err, res) {
      if (err) {
        console.log(err);
        whisk.done({ error: err });
      } else {
        console.log(res);

        var text = res.results[0].alternatives[0].transcript;

        Cloudant(params.cloudant_url).use(params.cloudant_db).insert({
          type: 'text_content',
          content: text,
          feedback_id: params.feedback_id,
          timestamp: +Date.now()
        });

        whisk.done();
      }
    });

    return whisk.async();
  } catch(e) {
    console.log(e.message, e.stack);
    whisk.done({ erorr: error });
  }
}
