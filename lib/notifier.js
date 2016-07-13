"use strict"

var cfg         = require('config'),
    log4js      = require('log4js'),
    GmailModel  = require('gmail-model')


// logs

log4js.configure(cfg.log.log4jsConfigs);

var log = log4js.getLogger(cfg.log.appName);
log.setLevel(cfg.log.level);


/*
 * Set up an emailer
 */

var mailer = new GmailModel({
  appSpecificPassword : cfg.mailbox.personal.password,
  clientSecretFile    : cfg.auth.clientSecretFile,
  emailsFrom          : cfg.mailbox.personal.emailsFrom,
  googleScopes        : cfg.auth.scopes.personal,
  name                : cfg.mailbox.personal.name,
  tokenDir            : cfg.auth.tokenFileDir,
  tokenFile           : cfg.auth.tokenFile.personal,
  user                : cfg.mailbox.personal.user
});


/**
 * HandleError
 *
 * @desc Send out an error notification
 *
 *
 * @alias HandleError
 *
 * @param {object=} params - Parameters for request
 * @param {string} errMsg
 */
function HandleError (errMsg) {

  var emailContent = "Error running payslip uploader.";
     emailContent += '<p>'+errMsg;

  mailer.sendMessage({
    body: emailContent,
    subject: "Payslip Saver ERROR",
    to: cfg.notificationEmail.to
  }, function(err) {

    if (err) {
      var errMsg = 'handleError: Error sending email: ' + err;
      log.error(errMsg)
    }
  });


}


/**
 * SendCompletionNotice
 *
 * @desc Send out a message once the script has completed successfully
 *
 * @alias SendCompletionNotice
 *
 * @param {object=} params - Parameters for request
 * @param {string} fileUrl
 * @param {string} folderUrl
 */
function SendCompletionNotice (params) {

  var emailContent = "Payslip uploader complete.\n";
     emailContent += '<p>\n';
     emailContent += 'File available at: ' + params.fileUrl;
     emailContent += '<br>\n';
     emailContent += 'Folder: ' + params.folderUrl;

  mailer.sendMessage({
    body: emailContent,
    subject: cfg.notificationEmail.subject,
    to: cfg.notificationEmail.to
  }, function(err) {

    if (err) {
      var errMsg = 'SendCompletionNotice: Error sending email: ' + err;
      log.error(errMsg)
      throw err
    }
  });


}

// export the class
exports.handleError = HandleError;
exports.sendCompletionNotice = SendCompletionNotice;
