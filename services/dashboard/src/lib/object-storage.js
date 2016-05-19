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

function prepareFileStream(buffer) {
  return streamifier.createReadStream(buffer);
}

function prepareStorageStream(path) {
  return storageClient.upload({
    container: 'audio',
    remote: path
  });
}

function upload(path, buffer) {
  return when.promise(function(resolve, reject) {
    var storageStream = prepareStorageStream(path);
    var fileStream = prepareFileStream(buffer);

    fileStream.pipe(storageStream);

    storageStream.on('success', function(data) {
      resolve(storageClient._serviceUrl + '/' + data.container + '/' + data.name);
    });

    storageStream.on('error', function(error) {
      reject(error);
    });
  });
}

// Doesn't fail if container exists
function createContainer() {
  return nodefn.call(storageClient.createContainer.bind(storageClient), {
    name: 'audio',
    metadata: { 'X-Container-Read': '.r:*' }
  });
}

function init() {
  setClient();
  return createContainer();
}

module.exports = {
  init: init,
  upload: upload
}
