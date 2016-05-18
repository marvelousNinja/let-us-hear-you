var when = require('when');
var nodefn = require('when/node');
var streamifier = require('streamifier');
var pkgcloud = require('pkgcloud');

var config = {
  provider: 'openstack',
  useServiceCatalog: true,
  useInternal: false,
  keystoneAuthVersion: 'v3',
  authUrl: process.env.OBJECT_STORAGE_AUTH_URL,
  tenantId: process.env.OBJECT_STORAGE_PROJECT_ID,
  domainId: process.env.OBJECT_STORAGE_DOMAIN_ID,
  username: process.env.OBJECT_STORAGE_USERNAME,
  password: process.env.OBJECT_STORAGE_PASSWORD,
  region: process.env.OBJECT_STORAGE_REGION
};

var storageClient;

function setClient() {
  storageClient = pkgcloud.storage.createClient(config);
  storageClient.CONTAINER_META_PREFIX = '';
}

function upload(path, buffer) {
  return when.promise(function(resolve, reject) {
    var fileStream = streamifier.createReadStream(buffer);

    var writeStream = storageClient.upload({
      container: 'audio',
      remote: path
    });

    fileStream.pipe(writeStream);

    writeStream.on('success', function(data) {
      resolve(storageClient._serviceUrl + '/' + data.container + '/' + data.name);
    });

    writeStream.on('error', function(error) {
      reject(error);
    });
  });
}

function init() {
  setClient();

  return nodefn.call(storageClient.createContainer.bind(storageClient), {
    name: 'audio',
    metadata: { 'X-Container-Read': '.r:*' }
  });
}

module.exports = {
  init: init,
  upload: upload
}
