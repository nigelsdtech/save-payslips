var cfg            = require('config'),
    drive          = require('./driveUploader.js'),
    log4js         = require('log4js'),
    notifier       = require('./lib/notifier.js'),
    payslipGetter  = require('./lib/payslipGetter.js'),
    triggerChecker = require('./lib/triggerChecker.js')



/*
* Download the monthly payslip and upload it to my Google Drive
*
*/


module.exports = function () {


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




  try {


    log.info('Checking processing is required...')

    // Get the email trigger
    triggerChecker.isProcessingRequired (null, function (err, isProcessingRequired) {

      if (err) {
        var errMsg = 'index.js Error checking processing is required: ' + err;
        log.error(errMsg)
        notifier.handleError(errMsg)
        return null;
      }

      if (!isProcessingRequired) {
        log.info('Processing isn\'t required. Ending program.')
        return null;
      }


      log.info('Processing is required.')
      log.info('Downloading payslip...')

      payslipGetter.downloadPayslip (null, function(err, downloadedFileLocation) {

        if (err) {
          var errMsg = 'index.js Error downloading payslip: ' + err;
          log.error(errMsg)
          notifier.handleError(errMsg)
          return null;
        }


        log.info('Payslip downloaded.')
        log.info('Uploading payslip to drive...')

        drive.uploadPayslip ({
          localFileLocation: downloadedFileLocation
        }, function (err, fileUrl, folderUrl) {

          if (err) {
            var errMsg = 'index.js Error uploading payslip: ' + err;
            log.error(errMsg)
            notifier.handleError(errMsg)
            return null;
          }

          log.info('Uploaded payslip to drive.')
          log.info('Sending completion notice...')

          notifier.sendCompletionNotice({
            fileUrl: fileUrl,
            folderUrl: folderUrl,
          });


          log.info('Script complete')
        });
      });
    })

  } catch (err) {

    var errMsg = 'Error in main body:\n ' + err + '\n' + err.stack;
    log.error(errMsg)
    notifier.handleError(errMsg)
    return null;
  }

  return;


}
