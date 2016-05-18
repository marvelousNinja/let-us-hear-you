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
