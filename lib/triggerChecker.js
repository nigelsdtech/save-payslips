"use strict"

var cfg                = require('config'),
    log4js             = require('log4js'),
    EmailNotification  = require('email-notification')


// logs

log4js.configure(cfg.log.log4jsConfigs);

var log = log4js.getLogger(cfg.log.appName);
log.setLevel(cfg.log.level);


// Create the email notification object
var en = new EmailNotification({
  gmailSearchCriteria: cfg.gmailSearchCriteria,
  processedLabelName: cfg.processedLabelName,
  gmail: {
    clientSecretFile : cfg.auth.clientSecretFile,
    googleScopes     : cfg.auth.scopes.work,
    name             : cfg.mailbox.work.name,
    tokenDir         : cfg.auth.tokenFileDir,
    tokenFile        : cfg.auth.tokenFile.work,
    user             : cfg.mailbox.work.user
  }
});


/**
 * IsProcessingRequired
 *
 * @desc Checks that a notification email has been received and requires processing
 *
 *
 * @alias IsProcessingRequired
 *
 * @param {object=} params - Parameters for request (currently no params supported)
 * @param {callback} callback - The callback that handles the response.
 *
 * @returns {boolean} isProcessingRequired
 */
function IsProcessingRequired(params,callback) {

  log.info('Checking if processing is required');
  log.info('Search criteria: %s', JSON.stringify(cfg.gmailSearchCriteria));

  // Get the email trigger
  en.hasBeenReceived (null, function (err, hasBeenReceived) {

    if (err) {
      var errMsg = 'notification: Error checking notification has been received: ' + err;
      log.error(errMsg)
      callback(errMsg)
      return null;
    }

    if (!hasBeenReceived) {
      log.info('Notification has not been received.')
      callback(null,false)
      return null;
    }

    log.info('Notification has been received.');

    en.hasBeenProcessed(null, function (err,hasBeenProcessed) {

      if (err) {
        var errMsg = 'notification: Error checking notification has been processed: ' + err;
        log.error(errMsg)
        callback(new Error(errMsg))
        return null;
      }

      // Has this already been processed? No need to go on.
      if (hasBeenProcessed) {
        log.info('Notification has already been processed.')
        callback(null,false)
        return null;
      }

      log.info("Notification not yet processed.")
      callback(null,true)

    })
  })
}


/**
 * UpdateLabels
 *
 * @desc Apply any necessary label updates (adding the processed label, removing the 'UNREAD' label)
 *
 * @alias UpdateLabels
 *
 * @param {object=} params - Parameters for request (currently no params supported)
 * @param {callback} callback - The callback that handles the response. No return data provided.
 */
function UpdateLabels (params,callback) {

}


// export the class
exports.isProcessingRequired = IsProcessingRequired;
exports.updateLabels = UpdateLabels;
