/*
* Download the monthly payslip and upload it to my Google Drive
*
*/


const cfg                = require('config'),
      log4js             = require('log4js'),
      emailNotification  = require('./lib/notification.js')


/*
* Initialize
*/


// logs

log4js.configure(cfg.log.log4jsConfigs);

var log = log4js.getLogger(cfg.log.appName);
log.setLevel(cfg.log.level);






/*
 * Main program
 */


log.info('Begin script');
log.info('============');



function handleError (errMsg) {

  var emailContent = "Error running payslip uploader " + emailMonth.toDateString();
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



try {


  // Get the email trigger
  emailNotification.isProcessingRequired (null, function (err, isProcessingRequired) {

    if (err) {
      var errMsg = 'index.js Error checking processing is required: ' + err;
      log.error(errMsg)
      handleError(errMsg)
      return null;
    }
 
    if (!isProcessingRequired) {
      log.info('Processing isn\'t required. Ending program.')
      return null;
    }

  })

} catch (err) {

  var errMsg = 'Error in main body:\n ' + err;
  log.error(errMsg)
  handleError(errMsg)
  return null;
}

return;



