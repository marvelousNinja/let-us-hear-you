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
app.use(autoprefixer({ browsers: 'last 2 versions', cascade: false }));
app.use(express.static(path.join(__dirname, 'public')));

var feedbackRepository = require('./lib/feedback-repository');
var displayHelper = require('./lib/display-helper');

app.get('/', function(req, res) {
  feedbackRepository.list()
    .then(function(resources) {
      res.render('home', { resources: displayHelper.recentFeedback(resources) });
    })
    .catch(function(err) { handleError(err, res) });
});

var upload = multer();
var importFeedback = require('./lib/import-feedback');
var uploadFeedback = require('./lib/upload-feedback');

app.post('/feedback', upload.single('audio'), function(req, res) {
  (req.file ? uploadFeedback(req.file) : importFeedback(req.body.content))
    .then(function() { res.redirect('/'); })
    .catch(function(err) { handleError(err, res) });
});

app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

app.use(function(err, req, res, next) { handleError(err, res) });

function handleError(err, res) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: err
  });
}

var database = require('./lib/database');
var objectStorage = require('./lib/object-storage');

database.init()
  .then(objectStorage.init)
  .then(function() {
    // TODO AS: Print correct port
    app.listen(process.env.PORT || 3000, function() { console.log('Example app listening on port 3000!');
  })
});
