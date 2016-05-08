var express = require('express');
var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');
var dotenv = require('dotenv');
var Cloudant = require('cloudant');

dotenv.load();

var connection = Cloudant(process.env.CLOUDANT_URL);
connection.db.create('let_us_hear_you');
var database = connection.db.use('let_us_hear_you');

var app = express();
app.set('view options', { layout: false });
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(logger('dev'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function(req, res) {
  database.list({ 'include_docs': true }, function(err, response) {
    if (err) {
      res.status(err.status || 500);
      res.render('error', {
        message: err.message,
        error: err
      });
    } else {
      res.render('home', {
        records: response.rows.map(function(row) { return row.doc; })
      });
    }
  });
});

app.post('/feedback', function(req, res) {
  database.insert({
    type: 'feedback',
    timestamp: +new Date()
  }, function(err) {
    if (err) {
      res.status(err.status || 500);
      res.render('error', {
        message: err.message,
        error: err
      });
    } else {
      res.redirect('/');
    }
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

app.listen(3000, function() { console.log('Example app listening on port 3000!'); });
