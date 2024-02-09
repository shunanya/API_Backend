"use strict";

const fs = require('fs');
const path = require('path');
const ssl_constant = require('constants');
const logger = require('log-tracking').getLogger('node_properties');
const constants = require('../constants');
const utils = require('./utils');

let options = {};
exports.options = options;

const opt = { /* default parameters */
    debug: [],
    https: {
        /* HTTPS certificates */
        // for details see https://nodejs.org/docs/latest-v12.x/api/all.html#crypto_openssl_options
        //
        // This is the default secureProtocol used by Node.js, but it might be
        // sane to specify this by default as it's required if you want to
        // remove supported protocols from the list. This protocol supports:
        //
        // - SSLv2, SSLv3, TLSv1, TLSv1.1 and TLSv1.2
        //
        secureProtocol: 'SSLv23_method',

        //
        // Supply `SSL_OP_NO_SSLv3` constant as secureOption to disable SSLv3
        // from the list of supported protocols that SSLv23_method supports.
        //
        // secureOptions: constants.SSL_OP_NO_SSLv3,//turn-back by Lusine request at 20.10.2014
        //
        // OpenSSL vulnerabilities CVE-2016-0703 and CVE-2016-0704
        // (https://support.f5.com/kb/en-us/solutions/public/k/95/sol95463126.html)
        // you should use 'constants.SSL_OP_NO_SSLv3 | constants.SSL_OP_NO_SSLv2' to mitigate this issue.
        //
        // SSL_OP_NO_TLSv1 | SSL_OP_NO_TLSv1_1
        // , minVersion: constants.TLS_MIN_VERSION //set the minimum allowed TLS version
        secureOptions: ssl_constant.SSL_OP_NO_TICKET | ssl_constant.SSL_OP_NO_SSLv3//disabling SSL session tickets extension and SSLv3 support
    },
    servers: {
        listen: []
    },
    self_resp: {
        /*
Secure header should be used when
action.reject, action.web_reject, action.unknown,...
*/
        headers: {
            "Date": '',
            'Server': 'Node.js ' + process.version,
            'Content-Type': 'application/json;charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST',
            'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-type,Accept,X-Access-Token,X-Key, Authorization',
            'Access-Control-Allow-Credentials': true,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Connection': 'close'
        },
        headers_s: {
            'X-Frame-Options': 'sameorigin',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
            'X-Content-Type-Options': 'nosniff',
            'X-XSS-Protection': '1; mode=block',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'X-Permitted-Cross-Domain-Policies': 'master-only',
            'Content-Security-Policy': "default-src 'self'",
            'Expires': '-1',
            "Date": '',
            'Server': 'Node.js ' + process.version,
            'Content-Type': 'text/html;charset=utf-8',
            'Connection': 'close'
        }
    },
    ACL: [],
    // utilities
    isDebugOn: function (key) {
        return this.debug.indexOf(key) >= 0;
    }
};

//let watching = false;	// var watching = true;//simulate that watching is on - to switch off watching
let props;

function print_options(name, option) {
    logger.debug(name + ': ' + JSON.stringify(option, function (key, value) {
        if (key === 'key' || key === 'certificates' || key === 'pfx') {
            return undefined;// removes uninteresting elements from generating string
        }
        return value;
    }, 2));
}

// exports.print_options = print_options;

/**
 * Compose the options object
 *
 * @param worker
 * @param  my_properties (optional) the custom properties that should be processed instead of original one
 */
const load = function (worker, my_properties) {
    function loadPFX(ssh_path, out_pfx) {
        const path_certPFX = path.join(ssh_path, 'server.pfx');
        if (fs.existsSync(path_certPFX) && typeof(out_pfx) === 'object') {
            out_pfx.pfx = fs.readFileSync(path_certPFX);
            out_pfx.passphrase = '11111111';
            return true;
        }
    }
    function loadPEM(ssh_path, out_pem) {
        const files = fs.readdirSync(ssh_path);
        const file_key = files.find((file) => {
            return file.endsWith('.key') && !file.endsWith('ca.key');
        });
        if (!file_key) {
            throw new Error('ssh certificate key is not exist (' + file_key + ')');
        }
        out_pem.key = fs.readFileSync(path.join(ssh_path, file_key), 'utf8');
        const file_crt = files.find((file) => {
            return file.endsWith('.crt') && !file.endsWith('ca.crt');
        });
        if (!file_crt) {
            throw new Error('ssh certificate crt is not exist (' + file_crt + ')');
        }
        out_pem.cert = fs.readFileSync(path.join(ssh_path, file_crt), 'utf8');

        const file_ca_crt = files.find((file) => {
            return file.endsWith('ca.crt');
        });
        if (!file_ca_crt) {
            logger.warn('ssh certificate ca.crt is not exist');
        } else {
            out_pem.ca = fs.readFileSync(path.join(ssh_path, file_ca_crt), 'utf8');
        }
        const file_ca_crl = files.find((file) => {
            return file.endsWith('ca.crl');
        });
        if (!file_ca_crl) {
            logger.warn('ssh ca.crl certificate is not exist');
        } else {
            out_pem.crl = fs.readFileSync(path.join(ssh_path, file_ca_crl), 'utf8');
        }
        // if (file_ca_crt && file_ca_crl) {
        //     out_pem.requestCert = true;
        //     out_pem.rejectUnauthorized = true;
        // }
        return true;
    }

    /**
     * Load the certificates and put them into configuration oibject
     * @param in_obj (Object) input object/loaded configuration
     * @param out_obj (Object) output object/precessed configuration
     */
    function load_cert(in_obj, out_obj) {
        let ssh_path;
        if (in_obj['ssh_path']) {
            ssh_path = utils.search_file(in_obj['ssh_path'], '/home/api/.ssh/');
        } else {
            ssh_path = utils.search_file('./.ssh/', '/home/api/.ssh/');
        }
        if (!fs.existsSync(ssh_path)) {
            throw new Error('ssh certificates path is not exist or specified incorrectly (' + ssh_path + ')');
        }
        if (!out_obj.certificates) {
            out_obj.certificates = {};
        }
        logger.debug('Load certificates from ' + ssh_path);
        if (!loadPFX(ssh_path, out_obj.certificates) && !loadPEM(ssh_path, out_obj.certificates)) {
            throw new Error('ssh certificates could not load or specified incorrectly');
        }
    }

    logger.info(worker + ': **** load config ****');
    if (typeof (my_properties) === 'object') {
        props = my_properties;
    } else {
        props = JSON.parse(fs.readFileSync(utils.search_file(constants.DEF_PROP_FILE_PATH), 'utf8'));
    }
    const prop_length = Object.keys(props).length;

    if (prop_length <= 0) {
        logger.warn(worker + ': No any properties specified');
        return;
    } else {// Initialization from properties
        logger.info(worker + ': ', prop_length, ' keys in property will be processed.');
        options = utils.mergeObjs(options || {}, opt);

        options.release = props.Release || options.release || 'API';
        options.version = props.Version || options.version || '1.0.0';
        options.vendor = props.Vendor || options.vendor || 'Private';
        if (props.Front) {
            options.ACL = utils.mergeObjs(options.ACL || [], props.Front.ACL);
            if (props.Front.servers) {
                if (!options.servers) {
                    options.servers = {};
                }
                if (!options.servers.cluster) {
                    options.servers.cluster = {};
                }
                options.servers.cluster.instances = (props.Front.servers.cluster && props.Front.servers.cluster.instances) || options.servers.cluster.instances || 0;
                options.servers.listen = utils.mergeObjs(options.servers.listen || [], props.Front.servers.listen);
                const arr = options.servers.listen;
                if (arr && Array.isArray(arr)) {
                    for (let i = 0; i < arr.length; i++) {
                        if (typeof (arr[i]) === 'object' && arr[i]['proto'].toLowerCase() === 'https') {
                            if (!options.servers.listen[i].certificates) {
                                options.servers.listen[i].certificates = {
                                    passphrase: '11111111',
                                    secureOptions: ssl_constant.SSL_OP_NO_TICKET | ssl_constant.SSL_OP_NO_SSLv3
                                };
                            }
                            load_cert(arr[i], options.servers.listen[i]);
                            if (options.servers.listen[i].requestCert != undefined){
                                options.servers.listen[i].certificates.requestCert = options.servers.listen[i].requestCert;
                            }
                            if (options.servers.listen[i].rejectUnauthorized != undefined){
                                options.servers.listen[i].certificates.rejectUnauthorized = options.servers.listen[i].rejectUnauthorized;
                            }

                        }
                    }
                }
                options.debug = props.Front.debug || options.debug || [];
                constants.KEY_GDPR_STRICT = !options.debug.includes('GDPR_weak');
            }
        }
        logger.info(worker + ': ' + options.release + "_" + options.version + "  DEBUG = " + JSON.stringify(options.debug));
    }
    logger.info(worker + ': options.https: ' + JSON.stringify(options.https, ["secureProtocol", "secureopt", "passphrase"]));
    options.initialized = true;
    options.worker = worker;
    if (logger.isDebugEnabled()) {
        print_options('Load properties', props);
    }
    return options;
};
exports.load = load;

if (!options.initialized) {
    logger.info('Primary Load...');
    load('PRIMARY_LOAD');
}
