"use strict";

const https = require("https");
const http = require("http");
const _ = require("lodash");
const logTR = require("log-tracking");
const logger = logTR.getLogger("node_server");
const log_error = logTR.getLogger("node_error");
const utils = require("./utilities/utils");
const options = require("./utilities/config").options;
const constants = require("./constants");

/**
 * Launching the REST API servers
 *  the request have to have the following style:
 *      (GET|POST) /token/vx/item/number/item/number....
 * @param WID [NUMBER] the worker id (can be omitted - default value is '0')
 */
const launch = (
 exports.launch = function (WID) {
   let servers = []; // HTTP(s) servers

   const mui = utils.getMachineUniqueId();
   constants.MACHINE_UNIQUE_ID = mui;
   let worker = mui + "." + (WID ? WID : 0); // Worker number

   options["worker"] = worker;

   console.log(JSON.stringify(options, function (key, value) {
     if (key === 'key' || key === 'certificates' || key === 'pfx') {
       return undefined;// removes uninteresting elements from generating string
     }
     return value;
   }, 2));

   // *** uncaughtException - Catch-all for monitoring uncaught exceptions
   process.on("uncaughtException", function (err) {
     log_error.error(worker + ": Un-caught exception: " + err + "\n" + err.stack);
     process.kill(process.pid, "SIGINT");
   });

   // *** Hook process events - This performs a graceful exit by allowing other SIGINT and SIGTERM hooks to process.
   process.once("SIGINT", function () {
     log_error.warn(worker + ": SIGINT received!!!");
     logger.warn(worker + ": SIGINT received!!!");
     stop();
   });

   process.once("SIGTERM", function () {
     log_error.warn(worker + ": SIGTERM received!!!");
     logger.warn(worker + ": SIGTERM received!!!");
     stop();
   });

   process.once("SIGHUP", function () {
     log_error.warn(worker + ": SIGHUP received!!!");
     logger.warn(worker + ": SIGHUP received!!!");
     stop();
   });

   /**
    * careful process ending
    */
   function stop() {
     logger.warn(worker + ": Process will be stopping...");
     if (servers && servers.length > 0) {
       let s;
       while ((s = servers.shift())) {
         try {
           s.close();
           logger.warn(worker + ": Server stopping...");
         } catch (err) {
           /* ignore */
         }
       }
     }
   }

    function createServers() {
     logger.info("Creating servers...");
     try {
       if (options.servers && options.servers.listen) {
         if (_.isArray(options.servers.listen)) {
           // Array of servers is defined
           const num_servers = options.servers.listen.length;
           logger.info(worker + ": " + num_servers + " servers will be created.");
           for (let i = 0; i < num_servers; i++) {
             const host = options.servers.listen[i].host || "0.0.0.0";
             const port = options.servers.listen[i].port || 80;
             const name = options.servers.listen[i].name || "???";
             if (options.servers.listen[i].proto !== "https") { //Creates HTTP server
               const http_server = http.createServer((req, res) => {
                 httpListener(req, res); // Calling the common processor
               }).listen(port, host);
               logger.info(worker + ": HTTP Server (" + name + ") started (" + worker + "/" + host + ":" + port + ")");
               servers.push(http_server);
             } else { //Creates HTTPS server
               // Secure connection should be used for API
               const https_server = https.createServer(options.servers.listen[i].certificates,
                   (req, res) => {
                     httpListener(req, res); // Calling the common processor
                   }
               ).listen(port, host);
               servers.push(https_server);
               logger.info(worker + ": HTTPS Server (" + name + ") started (" + worker + "/" + host + ":" + port + ")");
              }
           }
         }
       }
     } catch (err) {
       logger.error(worker + ": Could not create servers: " + err + "\n" + (err.stack || "stack undefined"));
       servers = [];
     }
     if (!servers || servers.length === 0) {
       throw new Error("Servers has not been created...");
     }
     return worker;
   }

   /**
    * Preparing the info
    *
    * @param req the request object
    * @returns the info object
    */
   function prepareInfo(req) {
     const info = {};
     info["t"] = new Date().toUTCString();
     if (req) {
       let client = undefined;
       try {
         if (Object.keys(req.socket.getPeerCertificate()).length > 0) {
           client = req.socket.getPeerCertificate().subject.CN;
         }
       } catch (err) {
         /*ignore*/
       }
       info["client"] = client;
       info["proto"] = utils.getProtocol(req);
       info["ip"] = utils.getClientIp(req);
       info["method"] = req.method.toUpperCase();
       info["path"] = new URL(req.url, "https://" + req.headers.host + "/").pathname;
     }
     return JSON.stringify(info);
   }

   /**
    * HTTP(s) requests common listener
    *
    * @param req the request object
    * @param res the response object
    */
   function httpListener(req, res) {
     const info = prepareInfo(req);
     if (req.method === "GET") {
       res.end(`${worker} ${info}`);
     } else if (req.method === "POST") {
       let body = "";
       req.on("data", (chunk) => {
         // collecting data.
         body += chunk;
       });
       req.on("end", () => {
         // request ended
         res.end(`${worker} ${info}`);
       });
     }
   }

   return createServers();
 });

if (require.main === module) {
  launch(); // In case this script is launched independently.
}



