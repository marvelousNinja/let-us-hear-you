var database = require('./database');

function list() {
  return database.view('events', 'for_feedback', { include_docs: true })
    .then(function(response) {
      var events = response[0].rows.map(function(row) { return row.doc });
      return replay(events);
    });
}

function replay(events) {
  var resources = [];

  if (events.length) {
    resources.push(initialState(events[0]));
  }

  events.forEach(function(event, i) {
    var currentResource = resources[resources.length - 1];

    if (currentResource.id !== event.aggregate_id) {
      currentResource = initialState(event);
      resources.push(currentResource);
    } else {
      Object.assign(currentResource.attributes, event.attributes);
      currentResource.last_event = event;
    }
  });

  return resources;
}

function initialState(event) {
  return {
    type: 'feedback',
    id: event.aggregate_id,
    timestamp: event.timestamp,
    attributes: event.attributes,
    last_event: event
  };
}

module.exports = {
  list: list
};
