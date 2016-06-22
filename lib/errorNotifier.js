"use strict"

var cfg                = require('config'),
    log4js             = require('log4js'),
    EmailNotification  = require('email-notification')


// logs

log4js.configure(cfg.log.log4jsConfigs);

var log = log4js.getLogger(cfg.log.appName);
log.setLevel(cfg.log.level);



function Notify (errMsg) {

  var emailContent = "Error running payslip uploader";
     emailContent += '<p>'+errMsg;

  mailer.sendEmail({
    content: emailContent
  }, function(err) {

    if (err) {
      var errMsg = 'handleError: Error sending email: ' + err;
      log.error(errMsg)
      return null;
    }
  });


}


// export the class
exports.notify = Notify;
