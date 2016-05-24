module.exports = {
  ignoreAlreadyExists: function(error) {
    if (error.statusCode !== 412) {
      throw error;
    }
  },

  ignoreNotFound: function(error) {
    if (error.statusCode !== 404) {
      throw error;
    }
  },

  handleServerError: function(error, response) {
    response.status(error.status || 500);
    response.render('error', {
      message: error.message,
      error: error
    });
  }
}
