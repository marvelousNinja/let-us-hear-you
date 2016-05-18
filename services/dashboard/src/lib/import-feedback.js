var database = require('./database');
var uuid = require('node-uuid');

function importFeedback(text) {
  return database.insert({
    type: 'event',
    name: 'TextAdded',
    aggregate_type: 'feedback',
    aggregate_id: uuid.v4(),
    timestamp: +new Date(),
    attributes: {
      text: text
    }
  });
}

module.exports = importFeedback;
