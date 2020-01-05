"use strict"

var
  cfg                = require('config'),
  log4js             = require('log4js'),
  promisify          = require('util').promisify,
  EmailNotification  = require('email-notification')


// logs

log4js.configure(cfg.log.log4jsConfigs);

var log = log4js.getLogger(cfg.log.appName);
log.setLevel(cfg.log.level);

const cfgTC  = cfg.triggerChecker;
const cfgTCa = cfgTC.auth;

// Create the email notification object
var en = new EmailNotification({
  gmailSearchCriteria: cfgTC.gmailSearchCriteria,
  processedLabelName: cfgTC.processedLabelName,
  gmail: {
    clientSecretFile : cfgTCa.clientSecretFile,
    googleScopes     : cfgTCa.scopes,
    tokenDir         : cfgTCa.tokenFileDir,
    tokenFile        : cfgTCa.tokenFile
  }
});


/**
 * isProcessingRequired
 *
 * @desc Checks that a notification email has been received and requires processing
 *
 *
 * @alias isProcessingRequired
 *
 *
 * @returns {Promise<boolean>} isProcessingRequired
 */
async function isProcessingRequired() {

  log.info('Checking if processing is required');
  log.info('Search criteria: ' + cfgTC.gmailSearchCriteria);

  // Get the email trigger
  en.flushCache();

  try {
    const hasBeenReceived = await promisify(en.hasBeenReceived).bind(en)(null)

    if (!hasBeenReceived) {
      log.info('Notification has not been received.')
      return false
    }

  } catch (err) {
    const errMsg = 'notification: Error checking notification has been received: ' + err;
    log.error(errMsg)
    throw new Error(errMsg)
  }

  log.info('Notification has been received.');

  try {
    const allHaveBeenProcessed = await promisify(en.allHaveBeenProcessed).bind(en)(null)

    if (allHaveBeenProcessed) {
      log.info('Notification has already been processed.')
      return false
    }
  } catch (err) {
    const errMsg = 'notification: Error checking notification has been processed: ' + err;
    log.error(errMsg)
    throw new Error (errMsg)
  }
  
  log.info("Notification not yet processed.")
  return true
}


/**
 * updateLabels
 *
 * @desc Apply any necessary label updates (adding the processed label, removing the 'UNREAD' label)
 *
 * @alias updateLabels
 *
 * @returns {Promise} - a promise that resolves when the work is complete (no actual value)
 */
async function updateLabels () {

  try {
    await promisify(en.updateLabels).bind(en)({
      applyProcessedLabel: (cfg.triggerChecker && cfg.triggerChecker.hasOwnProperty('applyProcessedLabel'))? cfg.triggerChecker.applyProcessedLabel : true,
      markAsRead: (cfg.triggerChecker && cfg.triggerChecker.hasOwnProperty('markAsRead'))? cfg.triggerChecker.markAsRead : true,
    })
  } catch (err) {

    const errMsg = 'notification: Error updating labels on notification email: ' + err;
    log.error(errMsg)
    throw (errMsg)
  }

}


// export the class
module.exports = {
  isProcessingRequired: isProcessingRequired,
  updateLabels: updateLabels
};