'use strict';

/**
 * Here is enumeration of constants which are used in IOT project.
 */
module.exports = {
    // defaults
    DEF_PROP_FILE_PATH      : './properties/config.json',
    DEF_CURRENT_VERSION     : 'v1.0.0',

    DEF_REJECT_PATHNAME     : new RegExp('^/\\S+\\.(ico|jpg|jpeg|png|bmp)$', 'i'),
    DEF_VALIDATE_URI        : new RegExp('^https\:\/\/[0-9a-zA-Z]([-.\w]*[0-9a-zA-Z])*(:(0-9)*)*(\/?)([a-zA-Z0-9\-\.\?\,\'\/\\\+&amp;%\$#_]*)?$','i'),
    DEF_VALIDATE_VERSION    : new RegExp('^v[0-9]+(\.[0-9]+(\.[0-9]+)?)?$','i'),
    MACHINE_UNIQUE_ID       : 'w0'
};

