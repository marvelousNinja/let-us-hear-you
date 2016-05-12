var express = require('express');
var path = require('path');
var logger = require('morgan');
var dotenv = require('dotenv');
var Promise = require('bluebird');
var Cloudant = require('cloudant');
var multer = require('multer');
var streamifier = require('streamifier');
var _ = require('underscore');
var autoprefixer = require('express-autoprefixer');

var upload = multer();

dotenv.load();

var connection = Cloudant(process.env.CLOUDANT_URL);
connection.db.create('let_us_hear_you');
var database = Promise.promisifyAll(connection.db.use('let_us_hear_you'));

// https://developer.ibm.com/recipes/tutorials/using-the-ibm-object-storage-for-bluemix-with-node-js-applications/
// https://github.com/pkgcloud/pkgcloud/pull/461/files
// https://github.com/pkgcloud/pkgcloud/issues/477
// https://developer.ibm.com/answers/questions/269436/bluemix-object-storage-and-pkgcloud-130.html
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

var storageClient = pkgcloud.storage.createClient(config);

// TODO AS: Maybe there's a better way to log stuff?
storageClient.on('log::*', function(message, object) {
  if (object) {
   console.log(this.event.split('::')[1] + ' ' + message);
   console.dir(object);
  }
  else {
    console.log(this.event.split('::')[1]  + ' ' + message);
  }
});

storageClient.CONTAINER_META_PREFIX = '';

// TODO AS: Callback is required... for some reason.
storageClient.createContainer({
  name: 'audio',
  metadata: { 'X-Container-Read': '.r:*' },
}, function() {});

var app = express();
app.set('view options', { layout: false });
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(logger('dev'));
app.use(autoprefixer({ browsers: 'last 2 versions', cascade: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function(req, res) {
  database.list({ 'include_docs': true }, function(err, response) {
    if (err) {
      res.status(err.status || 500);
      res.render('error', {
        message: err.message,
        error: err
      });
    } else {
      var resources = _.chain(response.rows)
        .pluck('doc')
        .filter(function(doc) { return doc.feedback_id; })
        .groupBy('feedback_id')
        .values()
        .map(function(events) { return Object.assign.apply(null, _.sortBy(events, 'timestamp')); })
        .sortBy('timestamp')
        .map(function(resource) {
          switch (resource.type) {
          case 'sms_notification':
            resource.status = 'notified';
            break;
          case 'emotion_report':
            resource.status = 'analyzed';
            break;
          case 'text_content':
            resource.status = 'waiting for emotion analysis';
            break;
          case 'audio_content':
            resource.status = 'waiting for text extraction';
            break;
          }

          return resource;
        })
        .reverse()
        .value();

      res.render('home', {
        resources: resources
      });
    }
  });
});

app.post('/feedback', upload.single('audio'), function(req, res) {
  database.insertAsync({
    type: 'feedback',
    timestamp: +new Date()
  }).then(function(response) {
    if (req.file) {
      var uploadPromise = new Promise(function(resolve, reject) {
        var fileStream = streamifier.createReadStream(req.file.buffer);

        var writeStream = storageClient.upload({
          container: 'audio',
          remote: response.id + '/' + req.file.originalname
        });

        fileStream.pipe(writeStream);

        writeStream.on('success', function(data) {
          resolve(storageClient._serviceUrl + '/' + data.container + '/' + data.name);
        });

        writeStream.on('error', function(error) {
          reject();
        });
      });

      return uploadPromise.then(function(audioPath) {
        return database.insertAsync({
          type: 'audio_content',
          path: audioPath,
          feedback_id: response.id,
          timestamp: +new Date()
        });
      });
    }

    return database.insertAsync({
      type: 'text_content',
      content: req.body.content,
      feedback_id: response.id,
      timestamp: +new Date()
    });
  }).then(function() {
    res.redirect('/');
  }).catch(function(error) {
    res.status(error.status || 500);
    res.render('error', {
      message: error.message,
      error: error
    });
  });
});

app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: err
  });
});

app.listen(process.env.PORT || 3000, function() { console.log('Example app listening on port 3000!'); });
