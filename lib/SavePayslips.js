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
 * @typedef uploadedFileDetails
 * @property {string} fileUrl
 * @property {string} folderUrl
 */

/**
 * Downloads the one latest payslip in the repo
 * 
 * @param {function} uploadFn - Function that will upload the payslip you get
 * @returns {Promise<uploadedFileDetails>[]} A single item array showing where on disk the payslip has been stored
 */
async function syncLatestPayslip({uploadFn} = {}) {
  // Download the payslip
  log.info('Downloading payslip...')
  const downloadedFileLocation = await payslipGetter.downloadPayslip()
  log.info(`Payslip downloaded to ${downloadedFileLocation}.`)

  return [
    await uploadFn(downloadedFileLocation)
  ]
}

/**
 * Gets the list of payslips in gdrive, compares them to the
 * payslip provider repo, and downloads ones that are missing.
 * 
 * @param {function} uploadFn - Function that will upload the payslip you get
 * @returns {Promise<uploadedFileDetails>[]} Array showing where on disk the payslips have been stored
 */
async function syncAllPayslips({uploadFn} = {}) {

  // Get the list of payslips in google drive
  // And the list from the payslip provider
  const [payslipsInDrive, payslipsWithProvider] = await Promise.all([
    drive.getKnownPayslips(),
    payslipGetter.getKnownPayslips()
  ])

  const allUploadedFileDetails = payslipsWithProvider.reduce((acc, payslipWithProvider) => {

    const logId = `${payslipWithProvider.id}`

    log.debug(`[${logId}] Looking for payslip ${JSON.stringify(payslipWithProvider)}...`)
    const found = payslipsInDrive.find((p) => {
      log.debug(`[${logId}] --> Comparing to ${JSON.stringify(p)}...`)
      return (p.date === payslipWithProvider.date && p.companyName === cfg.companyName)
    })

    // Payslip is found - no further action
    if (typeof found != 'undefined') {return acc}

    log.info(`[${logId}] Payslip missing. Downloading...`)

    const downloadDetails = Object.assign(payslipWithProvider,{suffix: cfg.companyName})

    const nextJob = 
      payslipGetter.downloadPayslip(downloadDetails)
      .then(downloadedFileLocation => {
        log.info(`[${logId}] Payslip downloaded to ${downloadedFileLocation}`)
        return uploadFn(downloadedFileLocation)
      })
      .then(uploadedFileDetails => {
        log.info(`[${logId}] Payslip upload details: ${JSON.stringify(uploadedFileDetails)}`)
        return uploadedFileDetails
      })

    return acc.concat(nextJob)


  }, [])

  return Promise.all(allUploadedFileDetails)

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
 * @returns {Promise<uploadedFileDetails>}
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

    const uploadedFileDetails = await (async() => {
      switch (downloadMode) {
        case 'sync':           return await syncAllPayslips  ({uploadFn: uploadPayslipToGdrive});
        case 'downloadLatest': return await syncLatestPayslip({uploadFn: uploadPayslipToGdrive});
        default: throw new Error(`Unknown download mode: ${downloadMode}`)
      }
    })()

    if (uploadedFileDetails.length == 0) {
      log.info('No new files downloaded. Exiting')
      return null
    }

    // Update the label on the trigger email
    if (useEmailTrigger) {
      log.info('Updating labels on trigger email...')

      currentError = 'Error updating labels on trigger email.'
      const triggerChecker = require('./triggerChecker.js');
      await triggerChecker.updateLabels()
    }

    // Completion notice
    log.info('Sending completion notice...')
    reporter.sendCompletionNotice({uploadedFileDetails: uploadedFileDetails})
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
