var nodefn = require('when/node');
var errorHandlers = require('./error-handlers');
var Cloudant = require('cloudant');

var connection = Cloudant(process.env.CLOUDANT_URL);
var databaseName = process.env.CLOUDANT_DB;

function createDatabase() {
  return nodefn.call(connection.db.create.bind(connection.db), databaseName);
}

var database;

function setDatabase() {
  database = connection.use(databaseName);
}

function setupViews() {
  return nodefn.call(database.get.bind(database), '_design/events')
    .catch(errorHandlers.ignoreNotFound)
    .then(function(response) {
      var designDoc = {
        views: {
          for_feedback: {
            map: function(doc) {
              if (doc.aggregate_id && doc.timestamp && doc.aggregate_type === 'feedback') {
                emit([doc.aggregate_id, doc.timestamp], null);
              }
            }
          }
        }
      };

      if (response) {
        designDoc._rev = response[0]._rev;
      }

      return nodefn.call(database.insert.bind(database), designDoc, '_design/events');
    });
}

function init() {
  return createDatabase()
    .catch(errorHandlers.ignoreAlreadyExists)
    .then(setDatabase)
    .then(setupViews)
}

module.exports = {
  init: init,
  insert: function() { return nodefn.apply(database.insert.bind(database), arguments); },
  view: function() { return nodefn.apply(database.view.bind(database), arguments); }
};
