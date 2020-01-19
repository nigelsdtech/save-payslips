"use strict"

const
  cfg          = require('config'),
  log4js       = require('log4js'),
  GdriveModel  = require('gdrive-model'),
  path         = require('path'),
  promisify    = require('util').promisify


// logs

log4js.configure(cfg.log.log4jsConfigs);

var log = log4js.getLogger(cfg.log.appName);
log.setLevel(cfg.log.level);


// Create the drive object
var g = new GdriveModel({
  googleScopes:     cfg.drive.auth.scopes,
  tokenFile:        cfg.drive.auth.tokenFile,
  tokenDir:         cfg.drive.auth.tokenFileDir,
  clientSecretFile: cfg.auth.clientSecretFile
});

let listFiles = promisify(g.listFiles).bind(g)
let createFile = promisify(g.createFile).bind(g)

/**
 * uploadPayslip
 *
 * @desc Uploads the specified payslip to google drive
 *
 *
 * @alias UploadPayslip
 *
 * @param {object=} params - Parameters for request
 * @param {string}  params.localFileLocation - Local location of the payslip to be uploaded
 *
 * @typedef {object} payslipUrls
 * @property {string} fileUrl
 * @property {string} folderUrl
 *
 * @returns {Promise<payslipUrls>}
 */
async function uploadPayslip({localFileLocation} = {}) {

  log.info('drive: Uploading Payslip from ' + localFileLocation);

  var fname = path.basename(localFileLocation);

  const {id: parentId, url: folderUrl} = await getPayslipFolderInfo({folderName: cfg.drive.payslipsFolderName});

  // Upload the file
  log.info('drive: Uploading file');
  const {webViewLink: fileUrl} = await createFile({
      localFile: localFileLocation,
      resource: {
        description: 'Payslip uploaded by ' + cfg.appName ,
        mimeType: 'application/pdf',
        parents: [{id: parentId}],
        title: fname
      },
      retFields: ['webViewLink']
  })


  log.info('drive: Payslip uploaded to ' + fileUrl)
  return {fileUrl,folderUrl}

}


let cachedFolderInfo = {}
/**
 * @typedef {object} payslipInfo
 * @property {number} id
 * @property {string} url
 */
/**
 * Get information about the payslip folder
 * @param {object} params
 * @param {string} params.folderName
 * 
 * @returns {Promise<payslipInfo>}
 */
async function getPayslipFolderInfo ({folderName} = {}) {

  if (cachedFolderInfo[folderName]) {return cachedFolderInfo[folderName]}

  const freetextSearch = `name='${folderName}' and mimeType ='application/vnd.google-apps.folder' and trashed = false`;
  log.info(`Searching drive for: ${freetextSearch}`);

  const results = await listFiles({
    freetextSearch: freetextSearch,
    spaces: 'drive',
    retFields: ['files/id', 'files/name', 'files/webViewLink']
  })

  if (results.length != 1) {
    const errMsg = 'drive: did not receive exactly one parent folder'
    log.error(errMsg)
    log.error(results)
    throw new Error(errMsg)
  }

  const {id, webViewLink: url} = results[0]

  log.info(`drive: Got folder: ${folderName} (${id})`);

  const payslipFolderInfo = {
    id: id,
    url: url
  }

  cachedFolderInfo[folderName] = payslipFolderInfo

  return payslipFolderInfo

}

/**
 * @typedef {object} knownPayslipInfo
 * @param {string} date - of the form 'yyyy-MM-dd'
 */
/**
 * Get a list of known payslips
 * @returns {Promise<knownPayslipInfo>}
 */
async function getKnownPayslips () {

  const {id: payslipFolderId} = await getPayslipFolderInfo({folderName: cfg.drive.payslipsFolderName})

  const freetextSearch = `'${payslipFolderId}' in parents and trashed = false`;
  log.info(`drive: Listing known payslips with search query: ${freetextSearch}`);

  return await listFiles({
    freetextSearch: freetextSearch,
    pageSize: 5,
    spaces: 'drive',
    retFields: ['files/name']
  })
  .then((payslips) => {
    return payslips.map((payslip) => {
      const [yyyy, mm, dd, company] = payslip.name.split('.')[0].split('-')
      return {date: `${yyyy}-${mm}-${dd}`, company: company}
    })
  })
  
}

module.exports = {
  uploadPayslip: uploadPayslip,
  getKnownPayslips: getKnownPayslips
}

