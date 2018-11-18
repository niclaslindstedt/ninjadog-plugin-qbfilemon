const chokidar = require('chokidar');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { filename } = require(`${global.appRoot}/lib/helpers`);

const config = {
  responseType: 'arraybuffer'
};
const emitter = global.emitter;

module.exports = class Files {
  constructor() {
    this.construct(__dirname);
  }

  setup() {
    this.setupListeners();
    const watcher = chokidar.watch(this.settings.watchDir);
    watcher
      .on('add', path => {
        global.emitter.emit('file.add', path);
      })
      .on('change', path => {
        global.emitter.emit('file.change', path);
      })
      .on('error', error => {});
  }

  async downloadFile(url, savePath, httpconfig, callback) {
    httpconfig = { ...config, ...httpconfig };
    const file = await axios
      .get(url, httpconfig)
      .then(response => response.data);

    if (!savePath.match('.')) {
      savePath = path.resolve(savePath, filename(url));
    }

    await fs.writeFile(savePath, file);
    global.emitter.emit('message', `Downloaded ${savePath}`, 'add', Files.name);

    if (callback) {
      return callback(savePath);
    }

    return Promise.resolve(savePath);
  }

  setupListeners() {
    emitter.register(
      'file.save',
      async (path, data) => {
        await fs.ensureFile(path);
        await fs.writeFile(path, data);
        return Promise.resolve(path);
      },
      Files.name
    );

    emitter.register(
      'file.download',
      async (url, savePath, httpconfig, callback) => {
        callback = typeof httpconfig === 'function' ? httpconfig : callback;
        httpconfig = typeof httpconfig === 'function' ? null : httpconfig;
        savePath = await this.downloadFile(url, savePath, httpconfig).catch(
          e => {
            emitter.emit(
              'message',
              `Error downloading ${savePath
                .split(path.sep)
                .pop()}, status: ${e}`,
              'error',
              Files.name
            );
          }
        );
        if (callback) {
          return callback(path);
        } else {
          return Promise.resolve(path);
        }
      },
      Files.name
    );
  }
};
