"use strict"

var cfg             = require('config'),
    log4js          = require('log4js'),
    PortusInteract  = require('portus-interact');


// logs

log4js.configure(cfg.log.log4jsConfigs);

var log = log4js.getLogger(cfg.log.appName);
log.setLevel(cfg.log.level);


// Create the portus object
var portus = new PortusInteract({
  username: cfg.portus.username,
  password: cfg.portus.password
});


/**
 * DownloadPayslip
 *
 * @desc Downloads the latest payslip from Portus
 *
 *
 * @alias DownloadPayslip
 *
 * @param {object=} params - Parameters for request (currently no params supported)
 * @param {callback} callback - The callback that handles the response. 
 *
 * @returns {boolean} downloadedFileLocation - Location of the file on the local system 
 */
function DownloadPayslip(params,callback) {

  log.info('Downloading Payslip');

  // Get the email trigger
  portus.downloadLatestPayslip (null, function (err, downloadedFileLocation) {

    if (err) {
      var errMsg = 'portus: Error downloading latest payslip: ' + err;
      log.error(errMsg)
      callback(errMsg)
      return null;
    }
 
    log.info("Payslip downloaded to " + downloadedFileLocation)
    callback(null,downloadedFileLocation)
   
  })
}


exports.downloadPayslip = DownloadPayslip;
