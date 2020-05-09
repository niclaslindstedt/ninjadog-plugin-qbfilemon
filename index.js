const chokidar = require('chokidar');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { filename } = require(`${global.appRoot}/lib/helpers`);

const config = {
  responseType: 'arraybuffer',
};
const emitter = global.emitter;

module.exports = class Files {
  constructor() {
    this.construct(__dirname);
  }

  setup() {
    this.logDebug('Setting up files plugin');
    this.setupFileWatcher();
    this.subscribe('file.save', actOnFileSave);
    this.subscribe('file.download', actOnFileDownload);
  }

  setupFileWatcher() {
    const watcher = chokidar.watch(this.settings.watchDir);
    watcher
      .on('add', (path) => {
        this.logDiag(`File added: ${path}`);
        this.emit('file.add', path);
      })
      .on('change', (path) => {
        this.logDiag(`File changed: ${path}`);
        this.emit('file.change', path);
      })
      .on('error', (error) => {
        this.logError(`Error from chokidar watch: ${error}`);
      });
  }

  async actOnFileSave(path, data) {
    this.logDiag(`Acting on saved file: ${path}`);
    await fs.ensureFile(path);
    await fs.writeFile(path, data);
    return Promise.resolve(path);
  }

  async actOnFileDownload(url, savePath, httpconfig, callback) {
    callback = typeof httpconfig === 'function' ? httpconfig : callback;
    httpconfig = typeof httpconfig === 'function' ? null : httpconfig;
    savePath = await this.downloadFile(url, savePath, httpconfig).catch((e) => {
      this.logError(
        `Error downloading ${savePath.split(path.sep).pop()}, status: ${e}`
      );
    });
    if (callback) {
      return callback(path);
    } else {
      return Promise.resolve(path);
    }
  }

  async downloadFile(url, savePath, httpconfig, callback) {
    httpconfig = { ...config, ...httpconfig };
    const file = await axios
      .get(url, httpconfig)
      .then((response) => response.data);

    if (!savePath.match('.')) {
      savePath = path.resolve(savePath, filename(url));
    }

    await fs.writeFile(savePath, file);
    this.logInfo(`Downloaded ${savePath}`);

    if (callback) {
      return callback(savePath);
    }

    return Promise.resolve(savePath);
  }
};
