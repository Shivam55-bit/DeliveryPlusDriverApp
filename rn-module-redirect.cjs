const fs = require('fs');
const Module = require('module');
const path = require('path');

const sourceRoot = '/Users/rajjeet/Documents/DeliveryPlusDriverApp-main/node_modules';
const localRoot = '/Users/rajjeet/Developer/DeliveryPlusDriverApp-latest/node_modules';
const resolveFilename = Module._resolveFilename;

Module._resolveFilename = function (request, parent, isMain, options) {
  const filename = parent && parent.filename;
  if (filename && filename.startsWith(`${sourceRoot}${path.sep}`)) {
    const localFilename = path.join(localRoot, path.relative(sourceRoot, filename));
    if (fs.existsSync(localFilename)) {
      if (request.startsWith('.') || path.isAbsolute(request)) {
        const localRequest = path.resolve(path.dirname(localFilename), request);
        if (fs.existsSync(localRequest)) request = localRequest;
      }
      options = {
        ...options,
        paths: [localRoot, ...(options?.paths || Module._nodeModulePaths(path.dirname(localFilename)))],
      };
    }
  }
  return resolveFilename.call(this, request, parent, isMain, options);
};

const readFileSync = fs.readFileSync;
fs.readFileSync = function (file, ...args) {
  try {
    return readFileSync.call(this, file, ...args);
  } catch (error) {
    if (error.code === 'ETIMEDOUT') console.error('FS_READ_TIMEOUT', file);
    throw error;
  }
};
