"use strict"

var cfg             = require('config'),
    log4js          = require('log4js'),
    promisify       = require('util').promisify,
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
 * @desc downloads the latest payslip from Portus
 *
 *
 * @alias downloadPayslip
 *
 * @param {object=} params - Parameters for request (currently no params supported)
 * @param {callback} callback - The callback that handles the response.
 *
 * @returns {boolean} downloadedFileLocation - Location of the file on the local system
 */
async function downloadPayslip(params) {

  log.info('payslipGetter: Downloading Payslip');

  const dlp = promisify(portus.downloadLatestPayslip)

  const downloadedFileLocation = await dlp()

  log.info("payslipGetter: Payslip downloaded to " + downloadedFileLocation)

  return downloadedFileLocation
}


module.exports.downloadPayslip = downloadPayslip;
