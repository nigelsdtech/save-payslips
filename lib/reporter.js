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
const cfgRp = cfg.reporter
var mailer = new GmailModel({
  appSpecificPassword : cfgRp.appSpecificPassword,
  emailsFrom          : cfgRp.emailsFrom,
  name                : `Reporter-${cfg.reporter.user}`,
  user                : cfgRp.user
});


/**
 * handleError
 *
 * @desc Send out an error notification
 *
 *
 * @alias handleError
 *
 * @param {object=} params - Parameters for request
 * @param {string} errMsg
 */
function handleError (errMsg) {

  const emailContent = `Error running payslip uploader.<p>${errMsg}`;

  mailer.sendMessage({
    body: emailContent,
    subject: `${cfg.reporter.subject} ERROR`,
    to: cfg.reporter.to
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
 * @alias sendCompletionNotice
 *
 * @param {object=} params - Parameters for request
 * @param {string} fileUrl
 * @param {string} folderUrl
 */
function sendCompletionNotice ({
  uploadedFileDetails = [{
    fileUrl: "",
    folderUrl: ""
  }]
} = {}) {

  const emailContent = `Payslip uploader complete.\n`.concat(
     '<p>\n',
     'Files available at:\n',
     uploadedFileDetails.map((fd) => {return fd.fileUrl}).join('<br>\n'),
     '<br>\n',
     'Folder: ' + uploadedFileDetails[0].folderUrl,
  )

  mailer.sendMessage({
    body: emailContent,
    subject: cfg.reporter.subject,
    to: cfg.reporter.to
  }, function(err) {

    if (err) {
      var errMsg = 'SendCompletionNotice: Error sending email: ' + err;
      log.error(errMsg)
      throw err
    }
  });


}

// export the class
exports.handleError = handleError;
exports.sendCompletionNotice = sendCompletionNotice;
