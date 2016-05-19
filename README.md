# Let Us Hear You

## Introduction
In this exercise we will create a customer feedback processing application using Node.js and several IBM Bluemix services:

 * OpenWhisk
 * Cloudant
 * Watson Speech-to-Text
 * Watson Tone Analyzer
 * Object Storage

The functional parts will be split into microservices what can be developed, deployed and scaled independently. All services will use JavaScript as their primary programming language.

Application will provide a way to import customer feedback messages as well as audio recordings. Internal services are going to analyse the text and provide emotion scores. As a result, customer Relations manager will receive an SMS notification in cases of extremely negative feedback.

```
Image for application here
```

## Prerequisites
Here's a list of software and external service accounts you would need to complete this lab:

  * IBM Bluemix account https://bluemix.net
  * Cloud Foundry CLI https://github.com/cloudfoundry/cli/releases
  * OpenWhisk (closed beta) access https://bluemix.net/openwhisk
  * OpenWhisk CLI https://bluemix.net/openwhisk/cli
  * Twilio account https://www.twilio.com/try-twilio
  * Linux/Mac OS
  * Node.js 4.4.x
  * Git

## Sending Notifications
Our application indeed analyses text, but there's no way to get information about negative feedback without constantly reading the website.

The purpose of this step is to implement `sms-notifier` service. Here's a high-level description of what it should do:

* Wait for `EmotionsAnalysed` event
* Check for levels of negative emotions (for example, anger)
* Send out SMS message to Customer Relations manager phone
* Emit `SmsNotificationSent` event

Let us implement `sms-notifier` service as an OpenWhisk action. That way we can reuse our experience with `analyzer` service.

1. Create a new service folder `sms-notifier`.
1. Add a `deploy.sh` script with the following contents:

	```bash
	#!/bin/bash

	source ./../config.env

	wsk action update sendSms send-sms.js \
	  -p cloudant_url https://$CLOUDANT_USERNAME:$CLOUDANT_PASSWORD@$CLOUDANT_HOST \
	  -p cloudant_db $CLOUDANT_DB \
	  -p twilio_url $TWILIO_URL \
	  -p twilio_sid $TWILIO_SID \
	  -p twilio_access_key $TWILIO_ACCESS_KEY \
	  -p twilio_phone_number $TWILIO_PHONE_NUMBER \
	  -p manager_phone_number $MANAGER_PHONE_NUMBER

	wsk rule create --enable sendSmsOnChange letUsHearYouDatabaseChanged sendSms
	```
	We use Cloudant and Twilio APIs here, so default parameters contain credentials to these services. `$MANAGER_PHONE_NUMBER` is a number to which text messages are going to be sent. If you are using trial Twilio account, you need to verify phone number beforehand.

1. Create a `remove.sh` script with the following code:

	```
	#!/bin/bash

	wsk rule delete --disable sendSmsOnChange
	wsk action delete sendSms
	```

1. Set executable flag on both scripts:

	```
	chmod +x deploy.sh remove.sh
	```

1. Now, let's implement OpenWhisk action itself. Create `send-sms.js` file:

	```
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
	```
	We follow the structure of `analyzer` service: `reportSuccess()`, `handleError()` and `main()` functions are almost the same. The only unique parts are `sendSms()` and `saveNotification()` functions.

1. Deploy action to OpenWhisk:

	```bash
	./deploy.sh
	```

1. Now, refresh the browser and input import some angry feedback. Here're some examples:

  * Sample link
  * Sample link
  * Sample link

1. You should see **notified** status if anger probability is above 50%:

  ```
  Image with notified state
  ```

  Text messages are usually arrive with a slight delay. However, make sure you've setup phone number correctly.

###Troubleshooting
TBD

## Uploading files
So far, our application analyses emotions from feedback text and sends notifications. However, we can improve it even further by adding support for audio file processing.

We will implement file uploads into Object Storage(link to the service here). Next step will cover actual audio processing.

1. Open terminal window and move to the Dashboard service directory
1. Install additional NPM packages: ```npm install --save streamifier pkgcloud multer```
1. Let's start with the upload form. Modify `src/views/home.pug` as follows:

  ```pug
    form.feedback-form(action='/feedback', method='post', enctype='multipart/form-data')
      .feedback-form__title Import Feedback
        textarea.feedback-form__content(name='content', rows='10', placeholder='Please, provide feedback text content here')
        label.feedback-form__audio
          input.feedback-form__file(type='file', name='audio')
          | Or Provide Audio Record
        button.feedback-form__submit.button(type='submit') Import Feedback
	```
	Refresh the page and verify that upload button appeared:

	```
	TODO AS: Uploaded image here
	```

1. Let's wire up some logic with our form. Modify feedback import handler and add `init()` hook in `src/index.js` like this:

	```javascript
		```javascript
	// src/index.js

	var upload = multer();
	var importFeedback = require('./lib/import-feedback');
	var uploadFeedback = require('./lib/upload-feedback');

	app.post('/feedback', upload.single('audio'), function(req, res) {
	  (req.file ? uploadFeedback(req.file) : importFeedback(req.body.content))
	    .then(function() { res.redirect('/'); })
	    .catch(function(err) { handleError(err, res) });
	});

	//...

	var database = require('./lib/database');
	var objectStorage = require('./lib/object-storage');

	database.init()
	  .then(objectStorage.init)
	  .then(function() {
	    // TODO AS: Print correct port
	    app.listen(process.env.PORT || 3000, function() { console.log('Example app listening on port 3000!');
	  })
	});
	```

	We check if there's a file in the form and upload it. Otherwise, we import plain text. In order to support upload, we've imported two new modules: `uploadFeedback` and `objectStorage`. Let's see how `uploadFeedback` can be implemented.

1. Create new file `src/lib/upload-feedback.js` with the following content:

	```javascript
	// src/lib/upload-feedback.js

	var database = require('./database');
	var objectStorage = require('./object-storage');
	var uuid = require('node-uuid');

	function uploadFeedback(file) {
	  var feedbackId = uuid.v4();
	  var filePath = feedbackId + '/' + file.originalname;

	  return objectStorage.upload(filePath, file.buffer)
	    .then(insertEvent.bind(null, feedbackId));
	}

	function insertEvent(feedbackId, audioPath) {
	  return database.insert({
	    type: 'event',
	    name: 'AudioUploaded',
	    aggregate_type: 'feedback',
	    aggregate_id: feedbackId,
	    timestamp: +new Date(),
	    attributes: {
	      path: audioPath
	    }
	  });
	}

	module.exports = uploadFeedback;
	```
	The module exports only one function - `uploadFeedback()`. Note that there're some similarities with `src/lib/import-feedback.js`. Primary function uploads a file using `objectStorage` and then inserts event. `insertEvent.bind(null, feedbackId)` is roughly an equivalent of this:

	```javascript
	function(audioPath) {
	  return insertEvent(audioPath, feedbackId);
	}
	```

	Finally, the last part of uploading logic, is `objectStorage` module. Let's implement it.

1. Create a new file `src/lib/object-storage.js` with the following content:

	```javascript
	// src/dashboard/lib/object-storage.js

	var when = require('when');
	var nodefn = require('when/node');
	var streamifier = require('streamifier');
	var pkgcloud = require('pkgcloud');

	var config = {
	  provider: 'openstack',
	  useServiceCatalog: true,
	  useInternal: false,
	  keystoneAuthVersion: 'v3',
	  authUrl: process.env.OBJECT_STORAGE_AUTH_URL,
	  tenantId: process.env.OBJECT_STORAGE_PROJECT_ID,
	  domainId: process.env.OBJECT_STORAGE_DOMAIN_ID,
	  username: process.env.OBJECT_STORAGE_USERNAME,
	  password: process.env.OBJECT_STORAGE_PASSWORD,
	  region: process.env.OBJECT_STORAGE_REGION
	};

	var storageClient;

	function setClient() {
	  storageClient = pkgcloud.storage.createClient(config);
	  storageClient.CONTAINER_META_PREFIX = '';
	}

	function upload(path, buffer) {
	  return when.promise(function(resolve, reject) {
	    var fileStream = streamifier.createReadStream(buffer);

	    var writeStream = storageClient.upload({
	      container: 'audio',
	      remote: path
	    });

	    fileStream.pipe(writeStream);

	    writeStream.on('success', function(data) {
	      resolve(storageClient._serviceUrl + '/' + data.container + '/' + data.name);
	    });

	    writeStream.on('error', function(error) {
	      reject(error);
	    });
	  });
	}

	function init() {
	  setClient();

	  return nodefn.call(storageClient.createContainer.bind(storageClient), {
	    name: 'audio',
	    metadata: { 'X-Container-Read': '.r:*' }
	  });
	}

	module.exports = {
	  init: init,
	  upload: upload
	}

	```
	Just like database module at `src/lib/database.js`, we've implemented an `init()` function. The reasoning behind this is that files in Object Storage need to be stored inside of a container what is basically the same as the folfer in a file system (link to the docs here). The container needs to be created before we will be able to upload any files.

	In order to simplify processing of the files later, we make our `audio` container public. That way, all our services will be able to download files without any special libraries or credentials.

	The hardest part is the `upload()`. First, it setups two Node.js Streams (link to the docs). Streams are abstractions to transfer data in chunks. Second, it directs the data from `fileStream` to `writeStream`. Third, it uses `when.js` library to convert event-based API into promise-based. As a result, `upload()` returns Promise, which, when resolved, provides a path to uploaded file.

1. Let's refresh a browser window and check if all works correctly. You can try to upload one of the following files using the form:
  * path to file
  * path to file
  * path to file

  After import, the record should display *waiting for text extraction* state:
  ```
  Image with outcome here
  ```

Now you should be ready for the final step: speech to text conversion and subsequent analysis.

### Possible issues
TBD

## Extracting Text from Speech
In the previous step we've added file upload capabilities to the `dashboard` service. Now, we can implement `text-extractor` service which will do the following:

* Wait for `AudioUploaded` events
* Download associated files
* Convert speech to text using Watson APIs
* Emit `TextAdded` event, so the system can perform emotion analysis using the existing code

Just like `sms-notifier` and `analyzer`, we can implement `text-extractor` as an OpenWhisk action.

1. Start by creating a new service folder `text-extractor`.
1. Create `deploy.sh` script:

	```bash
	#!/bin/bash

	source ./../config.env

	wsk action update extractText extract-text.js \
	  -p cloudant_url https://$CLOUDANT_USERNAME:$CLOUDANT_PASSWORD@$CLOUDANT_HOST \
	  -p cloudant_db $CLOUDANT_DB \
	  -p speech_to_text_url $SPEECH_TO_TEXT_URL \
	  -p speech_to_text_username $SPEECH_TO_TEXT_USERNAME \
	  -p speech_to_text_password $SPEECH_TO_TEXT_PASSWORD

	wsk rule create --enable extractTextOnChange letUsHearYouDatabaseChanged extractText
	```
	Since action needs to utilise Cloudant and Watson Speech-To-Text API, credentials are provided as default action parameters.

1. Corresponding `remove.sh` script can look like this:

	```bash
	#!/bin/bash

	wsk rule delete --disable extractTextOnChange
	wsk action delete extractText
	```

1. Set executable flag on both scripts:

	```bash
	chmod +x deploy.sh remove.sh
	```

1. Now we can actually implement OpenWhisk action at `extract-text.js`:

	```
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
	```
	Let's walk through key points. Again, we use `when.js` to turn callback-based API into promise-based in `recognizeSpeech()`. Then, we insert `TextAdded` event into Cloudant. Other parts are more or less simillar to other OpenWhisk actions.

1. Let's use `deploy.sh` script and check if `extract-text.js` works:

	```
	./deploy.sh
	```

1. Refresh browser window and try to import new audio file. Some samples here:
	* Sample file
	* Sample file
	* Sample file

1. Extracting text usually takes some time, but if you refresh the page in 10 seconds, you should see something like this:

	```
	Image with audio extract details
	```

###Troubleshooting
TBD

## Conclusion
Congratulations! You've implemented one of your first IBM Bluemix applications using microservices. From this point you can continue to improve it on your own. For example:

  * It might make sense to add more ways to notify the manager (email, social networks and etc.)
  * We can allow users to import feedback not by uploading a file, but by specifying URL
  * We can also add 're-import' functionality to process already imported feedback records (useful in cases where there was an error during original request)
  * And many more!


Good luck with your experiments!
