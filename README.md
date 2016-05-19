# Let Us Hear You

## Introduction
In this labwork we will create a customer feedback application using Node.js and several IBM Bluemix services:

 * OpenWhisk
 * Cloudant
 * Watson Speech-to-Text
 * Watson Tone Analyzer
 * Object Storage

The app will be split into microservices that can be developed, deployed and scaled independently. All services will use JavaScript as their primary programming language.

Application will provide a way to import customer feedback messages as well as audio recordings. Internal services are going to analyse the text and provide emotion scores. In case of extremely negative feedback, customer relations manager will receive an SMS notification.

![Application Homepage]
(./images/introduction_homepage.png)

## Prerequisites
Here's a list of software and external service accounts you would need to complete this labwork:

  * IBM Bluemix account: [https://bluemix.net](https://bluemix.net)
  * Cloud Foundry CLI: [https://github.com/cloudfoundry/cli/releases](https://github.com/cloudfoundry/cli/releases)
  * OpenWhisk (closed beta) access: [https://bluemix.net/openwhisk](https://bluemix.net/openwhisk)
  * OpenWhisk CLI: [https://bluemix.net/openwhisk/cli](https://bluemix.net/openwhisk/cli)
  * Twilio account: [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
  * Linux/Mac OS
  * Node.js 4.4.x
  * Git

## Getting started
Before we proceed with actual development, we need to get starting version of the app and get familiar with the code.

1. Open the terminal and navigate to the projects folder of your choice
1. Clone the repo:

	```bash
	git clone https://github.com/marvelousNinja/let-us-hear-you.git
	```

	The repo contains two branches:
	* master (completed labwork)
	* starting-point (boilerplate to start with)

1. Inspect the directory structure of the completed app:

	```bash
	let-us-hear-you
	├── README.md
	├── create-external-services.sh
	├── print-external-credentials.sh
	└── services
	    ├── .gitignore
	    ├── analyzer
	    │   ├── README.md
	    │   ├── analyze.js
	    │   ├── deploy.sh
	    │   └── remove.sh
	    ├── change-listener
	    │   ├── README.md
	    │   ├── deploy.sh
	    │   └── remove.sh
	    ├── config.env.sample
	    ├── dashboard
	    │   ├── .cfignore
	    │   ├── .env.sample
	    │   ├── .gitignore
	    │   ├── .nvmrc
	    │   ├── README.md
	    │   ├── deploy.sh
	    │   ├── manifest.yml
	    │   ├── package.json
	    │   ├── remove.sh
	    │   └── src
	    │       ├── index.js
	    │       ├── lib
	    │       │   ├── database.js
	    │       │   ├── display-helper.js
	    │       │   ├── feedback-repository.js
	    │       │   ├── import-feedback.js
	    │       │   ├── object-storage.js
	    │       │   └── upload-feedback.js
	    │       ├── public
	    │       │   └── home.css
	    │       └── views
	    │           ├── error.pug
	    │           └── home.pug
	    ├── sms-notifier
	    │   ├── README.md
	    │   ├── deploy.sh
	    │   ├── remove.sh
	    │   └── send-sms.js
	    └── text-extractor
	        ├── README.md
	        ├── deploy.sh
	        ├── extract-text.js
	        └── remove.sh
    ```

	Note that each service has its own directory under `services` which contains the source code and utility tools (for example, deployment scripts)

1. Make sure you've installed and configured OpenWhisk CLI: [https://bluemix.net/openwhisk/cli](https://bluemix.net/openwhisk/cli)

1. Login to Bluemix API using Cloud Foundry CLI:

	```bash
	cf login -a https://api.eu-gb.bluemix.net
	```

1. Create required Bluemix services with the following command:

	```bash
	./create-external-services.sh
	```

1. Create configuration files. `*.sample` files contain fake credentials:

	```bash
	cp services/dashboard/.env.sample services/dashboard/.env
	cp services/config.env.sample config.env
	```

1. Using credentials of created services, fill out created config files. You can get credentials for Bluemix services with:

	```bash
	./print-external-credentials.sh
	```

	Twilio credentials need to be obtained from Twilio dashboard: [https://www.twilio.com/user/account/voice/dev-tools/api-explorer/message-create?expanded=1](https://www.twilio.com/user/account/voice/dev-tools/api-explorer/message-create?expanded=1)

1. Let's checkout to `starting-point` branch and proceed from there:

	```bash
	git checkout starting-point
	```

1. We can start `dashboard` locally for now. However, other microservies need to be deployed anyway.

	```bash
	cd services/dashboard
	npm install
	npm run watch

	# and in different window
	./services/change-listener/deploy.sh
	./services/analyzer/deploy.sh
	```
	By default `dashboard` starts at 3000 port. It will restart itself every time you modify `*.js` files.

1. `dashboard` itself can be deployed too.

	```bash
	./services/dashboard/deploy.sh
	```

	Go ahead and try to import some feedback text via `dashboard` (either on `http://localhost:3000` or Bluemix URL printed by deploy script). If the process was successful, you should see emotion score numbers after a couple of refreshes:

	![Application Homepage]
	(./images/introduction_homepage.png)

### Troubleshooting
TBD

* In order to see invocations of OpenWhisk actions, you can use either OpenWhisk Dashboard, or (with OpenWhisk CLI):

	```bash
	wsk activation poll
	```

## Understanding the Architecture
Starting app has three primary services: `dashboard`, `change-listener` and `analyzer`. Let us explain how they work:

* Once user submits feedback form, `dashboard` inserts a document in Cloudant. Document looks like this:

	```javascript
	{
	  type: 'event',
	  name: 'TextAdded',
	  aggregate_type: 'feedback',
	  aggregate_id: '14141-12312312-412412414-123123',
	  timestamp: 1463629152101,
	  attributes: {
	    text: 'Sample Text'
	  }
	}
	```
	We do not store feedback records, but instead we store a sequence of events. That sequence can be replayed to construct feedback records.

	Every time we open the `dashboard`, it groups events by `aggregate_id` and replays them from the oldest to the most recent one. For example, if we add another event into the mix:
	
	```javascript
	// This event comes significantly later than
	// previous 'TextAdded'
	{
	  type: 'event',
	  name: 'EmotionsAnalysed',
	  aggregate_type: 'feedback',
	  aggregate_id: '14141-12312312-412412414-123123',
	  timestamp: 1463629159451,
	  attributes: {
	    emotions: { joy: '...', /*...*/ }
	  }
	}
	```
	and replay them both, we will result in the following feedback record:

	```javascript
	{
	  id: '14141-12312312-412412414-123123',
	  type: 'feedback',
	  timestamp: 1463629152101, // creation time
	  last_event: { name: 'EmotionsAnalysed', /*...*/ },
	  attributes: {
	    text: 'Sample Text',
	    emotions: { joy: '...', /*...*/ }
	  }
	}
	```
	Let's point out again, that feedback records themselves are never stored (they can be cached, by each new event should invalidate that cache). They're constucted on every request.
	
	Provided code is a naive implementation of Event Sourcing: [http://martinfowler.com/eaaDev/EventSourcing.html](http://martinfowler.com/eaaDev/EventSourcing.html).

* `change-listener` setups OpenWhisk trigger and feed [https://new-console.ng.bluemix.net/docs/openwhisk/openwhisk_triggers_rules.html](https://new-console.ng.bluemix.net/docs/openwhisk/openwhisk_triggers_rules.html). Basically, it calls attached OpenWhisk actions every time Cloudant database is updated. In our case - every time we insert an event into database.

* `analyzer` is an OpenWhisk action which is subscribed to `change-listener` feed. So, every time we insert an event, `analyze` is evaluated. That action generates another event: `EmotionsAnalysed`.

**IMPORTANT**. `change-listener` launches all associated actions on *every* update. For example, `analyzer` indirectly invokes itself again when it inserts `EmotionsAnalysed`. Because of this, all listening services have guard clauses to ignore events that they shouldn't process. This is temporary limitation of OpenWhisk and Cloudant integration which is going to be lifted: [https://github.com/openwhisk/openwhisk/issues/272](https://github.com/openwhisk/openwhisk/issues/272)

## Sending Notifications
Our application indeed analyses text, but there's no way to get information about negative feedback without constantly refreshing the website.

The purpose of this step is to implement `sms-notifier` service. Here's a high-level description of what it should do:

* Wait for `EmotionsAnalysed` event
* Check for levels of negative emotions (for example, anger)
* Send out SMS message to Customer Relations manager phone
* Emit `SmsNotificationSent` event

Let us implement `sms-notifier` service as an OpenWhisk action. That way we can reuse our experience with `analyzer` service.

1. Create a new service folder `sms-notifier`
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

	```bash
	#!/bin/bash

	wsk rule delete --disable sendSmsOnChange
	wsk action delete sendSms
	```

1. Set executable flag on both scripts:

	```bash
	chmod +x deploy.sh remove.sh
	```

1. Let's implement OpenWhisk action itself. However, before doing this, it might be useful to experiment with Twilio Api Explorer: [https://www.twilio.com/user/account/voice/dev-tools/api-explorer/message-create?expanded=1](https://www.twilio.com/user/account/voice/dev-tools/api-explorer/message-create?expanded=1). After that, create `send-sms.js` file:

	```bash
	var request = require('request');
	var nodefn = require('when/node');
	var Cloudant = require('cloudant');

	function processEvent(params) {
	  var lowAngerChance = params.attributes.emotions.anger.score < 0.5;
	  var lowDisgustChance = params.attributes.emotions.disgust.score < 0.5;

	  if (lowAngerChance && lowDisgustChance) {
	    return;
	  }

	  sendSms(params).
	    then(insertEvent.bind(null, params)).
	    then(reportSuccess).
	    catch(handleError.bind(null, params))

	  return whisk.async();
	}

	function sendSms(params) {
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

	function insertEvent(params) {
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

	function ignoreEvent(params) {
	  var notAnEvent = params.type !== 'event';
	  var notEmotionAnalysed = params.name !== 'EmotionsAnalysed';

	  return notAnEvent || notEmotionAnalysed;
	}

	// Can be copied from `analyze` action
	function main() { /*...*/ }
	function reportSuccess() { /*...*/ }
	function handleError() { /*...*/ }

	```
	We follow the structure of `analyzer` service.

1. Note how we convert callback based API into Promise using When.js. Docs can be found here: [https://github.com/cujojs/when/blob/master/docs/api.md#nodecall](https://github.com/cujojs/when/blob/master/docs/api.md#nodecall). That method is being used quite often around the codebase.

1. Deploy the action to OpenWhisk:

	```bash
	./deploy.sh
	```

1. Now, refresh the browser and input import some angry feedback. Here're some examples:

  * TBD
  * TBD
  * TBD

1. You should see **manager has been notified** status if anger probability is above 50%:

	![Manager Notification]
	(./images/sending-notifications_manager.png)

  Phone notifications usually arrive with a slight delay. However, make sure you've setup phone number correctly.

###Troubleshooting
TBD

## Uploading files
So far, our application analyses emotions from feedback text and sends notifications. However, we can improve it even further by adding support for audio file processing.

We will implement file uploads into Object Storage: [https://console.ng.bluemix.net/catalog/services/object-storage](https://console.ng.bluemix.net/catalog/services/object-storage). If you're interested in underlying technology, you can consult OpenStack SWIFT documentation: [http://docs.openstack.org/developer/swift/api/object_api_v1_overview.html](http://docs.openstack.org/developer/swift/api/object_api_v1_overview.html)

Actual audio processing will be covered a bit later.

1. Open terminal window and move to the Dashboard service directory
1. Install additional NPM packages:

	```bash
	npm install --save streamifier pkgcloud multer
	```

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

	![Upload Form]
	(./images/uploading-files_form.png)

1. Let's wire up some logic with our form. Modify feedback import handler and add `init()` hook in `src/index.js` like this:

	```javascript
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
	    var port = process.env.PORT || 3000;
    	app.listen(port, function() { console.log('Listening on port', port); });
	  });
	```

	We check if there's a file in the form and upload it. Otherwise, we import plain text. In order to support upload, we've imported two new modules: `uploadFeedback` and `objectStorage`. Let's see how `uploadFeedback` can be implemented.

1. Create new file `src/lib/upload-feedback.js` with the following content:

	```javascript
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
	The module exports only one function - `uploadFeedback()`. Note that there're some similarities with `src/lib/import-feedback.js`. Primary function uploads a file using `objectStorage` and then inserts event.

	Finally, the last part of uploading logic, is `objectStorage` module. Let's implement it.

1. Create a new file `src/lib/object-storage.js` with the following content:

	```javascript
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

	function prepareFileStream(buffer) {
	  return streamifier.createReadStream(buffer);
	}

	function prepareStorageStream(path) {
	  return storageClient.upload({
	    container: 'audio',
	    remote: path
	  });
	}

	function upload(path, buffer) {
	  return when.promise(function(resolve, reject) {
	    var storageStream = prepareStorageStream(path);
	    var fileStream = prepareFileStream(buffer);

	    fileStream.pipe(storageStream);

	    writeStream.on('success', function(data) {
	      resolve(storageClient._serviceUrl + '/' + data.container + '/' + data.name);
	    });

	    writeStream.on('error', function(error) {
	      reject(error);
	    });
	  });
	}

	// Doesn't even if container exists
	function createContainer() {
	  return nodefn.call(storageClient.createContainer.bind(storageClient), {
	    name: 'audio',
	    metadata: { 'X-Container-Read': '.r:*' }
	  });
	}

	function init() {
	  setClient();
	  return createContainer();
	}

	module.exports = {
	  init: init,
	  upload: upload
	}
	```
	Just like database module at `src/lib/database.js`, we've implemented an `init()` function. The reasoning behind this is that files in Object Storage need to be stored inside of a container. Container is basically the same as a directory in a file system: [http://docs.openstack.org/developer/swift/api/object_api_v1_overview.html](http://docs.openstack.org/developer/swift/api/object_api_v1_overview.html). The container needs to be created before we will be able to upload any files.

	In order to simplify processing of the files later, we make our `audio` container public (by specifying `X-Container-Read`). That way, all our services will be able to download files without any special libraries or credentials.

	The hardest part is the `upload()`. First, it setups two Node.js Streams: [https://nodejs.org/api/stream.html#stream_stream](https://nodejs.org/api/stream.html#stream_stream). Streams are abstractions to transfer data in chunks. Second, it directs the data from `fileStream` to `writeStream`. Third, it uses When.js library to convert event-based API into promise-based. As a result, `upload()` returns Promise, which, when resolved, provides a path to uploaded file.

1. Let's refresh a browser window and check if all works correctly. You can try to upload one of the following files using the form:
  * TBD
  * TBD
  * TBD

  After import, the record should display **waiting for text extraction** state:

  ![Waiting for text extraction]
  (./uploading-files_extraction.png)


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

	```javascript
	var watson = require('watson-developer-cloud');
	var request = require('request');
	var nodefn = require('when/node');
	var Cloudant = require('cloudant');

	function processEvent(params) {
	  recognizeSpeech(params)
	    .then(insertEvent.bind(null, params))
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

	function insertEvent(params, response) {
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

	function ignoreEvent(params) {
	  var notAnEvent = params.type !== 'event';
	  var notAudioUploaded = params.name !== 'AudioUploaded';

	  return notAnEvent || notAudioUploaded;
	}

	// Can be copied from previous actions
	function main() { /*...*/ }
	function reportSuccess() { /*...*/ }
	function handleError() { /*...*/ }
	```
	Let's walk through key points. Again, we use When.js to turn callback-based API into promise-based in `recognizeSpeech()`. Then, we insert `TextAdded` event into Cloudant. Other parts are more or less simillar to other OpenWhisk actions.

1. Let's use `deploy.sh` script and check if `extract-text.js` works:

	```
	./deploy.sh
	```

1. Refresh browser window and try to import new audio file. TODO: Only FLAC files will work now. Some samples here:
	* TBD
	* TBD
	* TBD

1. Extracting text usually takes some time, but if you refresh the page in 10 seconds, you should see something like this:

	![Extracting Text]
	(./extracting-text__results.png)

###Troubleshooting
TBD

## Conclusion
Congratulations! You've implemented one of your first IBM Bluemix applications using microservices. From this point you can continue to improve it on your own. For example:

  * It might make sense to add more ways to notify the manager (email, social networks and etc.)
  * We can allow users to import feedback not by uploading a file, but by specifying URL
  * We can also add 're-import' functionality to process already imported feedback records (useful in cases where there was an error during original request)
  * And many more!


Good luck with your experiments!
