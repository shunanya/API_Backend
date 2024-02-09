"use strict";

const cluster = require("cluster");
const numCPUs = require("os").cpus().length;
const server = require("./server");
const options = require("./utilities/config").options;
const logger = require("log-tracking").getLogger("cluster");

//The store requires that a shared-state server is running in the master process.
//The server will be initialized automatically when you call require() for this module from the master.
//In case that your master and workers have separate source files, you must explicitly require this module in your master source file.
//Optionally, you can call setup() to make it more obvious why you are loading a module that is not used anywhere else.
//var shareTlsSessions = require('strong-cluster-tls-store').setup();

let workers = (options && options.servers && options.servers.cluster && options.servers.cluster.instances) || 0;
logger.info(`*** Required number of workers = ${workers} ***`);
if (workers > numCPUs) {
  logger.warn(`There are only ${numCPUs} CPU cores exist which is less than described workers number (${workers}`);
  workers = numCPUs;
} else if (workers < 0) {
  workers = 0;
}

if (workers > 0) { // cluster mode
  logger.info(`***** Run Node.js server in cluster mode with ${workers} workers *****`);

  if (cluster.isMaster) {
    const map = {};

    const forkWorker = function (data) {
      const worker = cluster.fork({
        data: data,
      });
      map[worker.id] = data;
    };

    // Fork workers.
    for (let i = 0; i < workers; i++) {
      forkWorker(i);
    }

    cluster.on("exit", function (worker, code, signal) {
      logger.warn(`Worker ${worker.process.pid} died (${worker.process.env})`);
      const data = map[worker.id];
      delete map[worker.id]; // We don't need old id mapping.
      forkWorker(data);
    });

    cluster.on("listening", function (worker, address) {
      logger.info(`A worker is now connected to ${worker.id}.${address.address}:${address.port}`);
    });
  } else {
    logger.info(`A new worker is launched: ${process.env.data}`);
    const id = server.launch(process.env.data);
    logger.info("serverID = " + id);
  }
} else {
  // run without cluster
  logger.info("***** Run Node.js server without cluster mode *****");
  server.launch();
}
