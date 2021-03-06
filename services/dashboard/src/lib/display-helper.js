var EVENT_NAME_TO_STATUS = {
  'TextAdded': 'waiting for text analysis',
  'AudioUploaded': 'waiting for text extraction',
  'EmotionsAnalyzed': 'analyzed',
  'SmsNotificationSent': 'manager has been notified',
  'ErrorOccurred': 'error occurred'
};

function recentFeedback(resources) {
  return resources.map(function(resource) {
    resource.attributes.status = EVENT_NAME_TO_STATUS[resource.last_event.name] || 'unknown';
    return resource;
  }).sort(function(a, b) { return b.timestamp - a.timestamp });
}

module.exports = {
  recentFeedback: recentFeedback
};
