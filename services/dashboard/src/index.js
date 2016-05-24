var dotenv = require('dotenv');
dotenv.load();

var express = require('express');
var path = require('path');
var logger = require('morgan');
var multer = require('multer');
var autoprefixer = require('express-autoprefixer');

var app = express();
app.set('view options', { layout: false });
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(logger('dev'));
app.use(autoprefixer({ browsers: 'last 3 versions', cascade: false }));
app.use(express.static(path.join(__dirname, 'public')));

var handleServerError = require('./lib/error-handlers.js').handleServerError;
var feedbackRepository = require('./lib/feedback-repository');
var displayHelper = require('./lib/display-helper');

app.get('/', function(req, res) {
  feedbackRepository.list()
    .then(function(resources) {
      res.render('home', { resources: displayHelper.recentFeedback(resources) });
    })
    .catch(function(err) { handleServerError(err, res) });
});

var upload = multer();
var importFeedback = require('./lib/import-feedback');
var uploadFeedback = require('./lib/upload-feedback');

app.post('/feedback', upload.single('audio'), function(req, res) {
  (req.file ? uploadFeedback(req.file) : importFeedback(req.body.content))
    .then(function() { res.redirect('/'); })
    .catch(function(err) { handleServerError(err, res) });
});

app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

app.use(function(err, req, res, next) { handleServerError(err, res) });

var database = require('./lib/database');
var objectStorage = require('./lib/object-storage');

database.init()
  .then(objectStorage.init)
  .then(function() {
    var port = process.env.PORT || 3000;
    app.listen(port, function() { console.log('Listening on port', port); });
  });
