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

app.post('/feedback', upload.array(), function(req, res) {
  importFeedback(req.body.content)
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

database.init()
  .then(function() {
    var port = process.env.PORT || 3000;
    app.listen(port, function() { console.log('Listening on port', port); });
  })
  .catch(function(error) { throw error });
