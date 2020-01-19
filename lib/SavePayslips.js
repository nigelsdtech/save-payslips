var
  cfg            = require('config'),
  drive          = require('./driveUploader.js'),
  log4js         = require('log4js'),
  reporter       = require('./reporter.js'),
  promisify      = require('util').promisify,
  // This will but set if the configured payslipGetter model doesn't exist
  payslipGetter  = require(`./payslipGetter${cfg.payslipGetter}`);



/*
* Download the monthly payslip and upload it to my Google Drive
*
*/

  /*
  * Initialize
  */


  // logs

  log4js.configure(cfg.log.log4jsConfigs);

  var log = log4js.getLogger(cfg.log.appName);
  log.setLevel(cfg.log.level);


module.exports = async function () {

  /*
   * Main program
   */

  log.info('Begin script');
  log.info('============');

  await main({
    useEmailTrigger: (typeof cfg.useEmailTrigger === undefined)? true   : cfg.useEmailTrigger,
    downloadMode:    (typeof cfg.downloadMode    === undefined)? 'sync' : cfg.downloadMode
  })
}


/**
 * Downloads the one latest payslip in the repo
 * 
 * @returns {Promise<string[]>} A single item array showing where on disk the payslip has been stored
 */
async function downloadLatestPayslip() {
  // Download the payslip
  log.info('Downloading payslip...')
  const downloadedFileLocation = await payslipGetter.downloadPayslip()
  log.info('Payslip downloaded.')
  return [downloadedFileLocation]
}

/**
 * Gets the list of payslips in gdrive, compares them to the
 * payslip provider repo, and downloads ones that are missing.
 * 
 * @returns {Promise<string[]>} Array showing where on disk the payslips have been stored
 */
async function downloadSyncedPayslips() {

  // Get the list of payslips in google drive
  // And the list from the payslip provider
  const [payslipsInDrive, payslipsWithProvider] = await Promise.all([
    drive.getKnownPayslips(),
    payslipGetter.getKnownPayslips()
  ])

  // Look for ones in the payslip provider that are missing in gdrive
  const missingPayslips = payslipsWithProvider
    .filter((payslipWithProvider) => {
      log.debug(`Comparing payslip ${JSON.stringify(payslipWithProvider)}...`)
      const found = payslipsInDrive.find((p) => {
        log.debug(`\tTo ${JSON.stringify(p)}...`)
        return (p.date === payslipWithProvider.date && p.company === cfg.companyName)
      })
      return (typeof found === 'undefined')
    })

  log.info('Missing payslips are: ' + JSON.stringify(missingPayslips))
 
  // Download the missing ones
  const downloadedFileLocations = await Promise.all(
    missingPayslips
    .map(async (mp) => {
      log.info(`Downloading payslip ${mp.date}...`)
      const downloadedFileLocation = await payslipGetter.downloadPayslip(Object.assign(mp,{suffix: cfg.companyName}))
      log.info(`Payslip ${mp.date} downloaded.`)
      return downloadedFileLocation
    })
  )
  
  return downloadedFileLocations
}

/**
 * @desc Check if processing is required
 * 
 * @return {Promise<boolean>} isProcessingRequired
 */
async function isProcessingRequired() {

  const triggerChecker = require('./triggerChecker.js');

  log.info('Checking processing is required...')

  const isProcessingRequired =
    await triggerChecker.isProcessingRequired()
    .catch ((e) => {
      log.error('Error while checking processing is required: ' + e.message)
      throw e
    })

  const logMsg = (isProcessingRequired)? "is" : "isn't";

  log.info(`Processing ${logMsg} required.`)

  return isProcessingRequired

}


/**
 * Uploads a file to google drive
 * 
 * @param {string} downloadedFileLocation - location of the file on disk
 *
 * @returns {Promist<object>} {fileUrl, folderUrl} 
 */
async function uploadPayslipToGdrive(downloadedFileLocation) {

  log.info(`Uploading payslip ${downloadedFileLocation} to drive...`)

  const {fileUrl, folderUrl} = await drive.uploadPayslip ({
    localFileLocation: downloadedFileLocation
  })

  log.info(`Uploaded payslip ${downloadedFileLocation} to drive.`)

  return {fileUrl, folderUrl}
}


/**
 * Main logic
 * 
 */
async function main ({
  useEmailTrigger = true,
  downloadMode = 'sync'
} = {}) {

  var currentError = null

  try {

    // Get the email trigger
    if (useEmailTrigger) {
      currentError = 'Error checking processing is required.'
      const ipr = await isProcessingRequired()
      if (!ipr) {return null}
    }

    // Download the payslip(s)
    currentError = 'Error downloading payslip(s).'

    const downloadedFileLocations = await (async() => {
      switch (downloadMode) {
        case 'sync':           return await downloadSyncedPayslips();
        case 'downloadLatest': return await downloadLatestPayslip();
        default: throw new Error(`Unknown download mode: ${downloadMode}`)
      }
    })()

    // Upload the payslip to gdrive
    currentError = 'Error uploading payslip.'
    const uploadedFileDetails = await Promise.all(
      downloadedFileLocations
      .map((dfl) => {return uploadPayslipToGdrive(dfl)})
    )

    // Update the label on the trigger email
    if (useEmailTrigger) {
      log.info('Updating labels on trigger email...')

      currentError = 'Error updating labels on trigger email.'
      const triggerChecker = require('./triggerChecker.js');
      await triggerChecker.updateLabels()
    }

    // Completion notice
    log.info('Sending completion notice...')
    reporter.sendCompletionNotice(uploadedFileDetails)
    log.info('Script complete')

  } catch (err) {
    const errMsg = `SavePayslip.js - Error in main body:\n`.concat(
      currentError + '\n',
      err.stack
    )
    log.error(errMsg)
    reporter.handleError(errMsg)
  }

  return;
}
