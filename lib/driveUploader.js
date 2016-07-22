"use strict"

var cfg          = require('config'),
    log4js       = require('log4js'),
    GdriveModel  = require('gdrive-model'),
    path         = require('path')


// logs

log4js.configure(cfg.log.log4jsConfigs);

var log = log4js.getLogger(cfg.log.appName);
log.setLevel(cfg.log.level);


// Create the drive object
var g = new GdriveModel({
  googleScopes:     cfg.auth.scopes.personal,
  tokenFile:        cfg.auth.tokenFile.personal,
  tokenDir:         cfg.auth.tokenFileDir,
  clientSecretFile: cfg.auth.clientSecretFile
});


/**
 * UploadPayslip
 *
 * @desc Uploads the specified payslip to google drive
 *
 *
 * @alias UploadPayslip
 *
 * @param {object=} params - Parameters for request
 * @param {string}  params.localFileLocation - Local location of the payslip to be uploaded
 * @param {callback} callback - The callback that handles the response.
 *
 * @returns {boolean} driveFileUrl - The google drive file url
 * @returns {boolean} parentUrl - The folder in which the file is located
 */
function UploadPayslip(params,callback) {

  log.info('drive: Uploading Payslip from ' + params.localFileLocation);

  var fname = path.basename(params.localFileLocation);

  log.info('drive: Getting payslips folder id with search query:');
  var freetextSearch = "name='" + cfg.drive.payslipsFolderName + "' and mimeType = 'application/vnd.google-apps.folder'";
  log.info(freetextSearch);

  // Get the id of the payslips folder
  g.listFiles({
    freetextSearch: freetextSearch,
    spaces: 'drive',
    retFields: ['files/id', 'files/name', 'files/webViewLink']
  }, function (err, results) {

    if (err) { callback(err); return null }

    if (results.length != 1) {
      var errMsg = 'drive: did not receive exactly one parent folder'
      log.error(errMsg)
      log.error(results)
      callback(new Error(errMsg));
      return null
    }

    log.info('drive: Got folder: %s (%s)', results[0].name, results[0].id);
    var parentId = results[0].id,
        parentUrl = results[0].webViewLink;

    // Upload the file
    log.info('drive: Uploading file');
    g.createFile({
       localFile: params.localFileLocation,
       resource: {
         description: 'Payslip uploaded by ' + cfg.appName ,
         mimeType: 'application/pdf',
         parents: [{id: parentId}],
         title: fname
       },
       retFields: ['id', 'webViewLink']
    }, function (err, resp) {

      if (err) { callback(err); return null }

      log.info('drive: Payslip uploaded to ' + resp.webViewLink)
      callback(null,resp.webViewLink,parentUrl)

    })
  })


}


exports.uploadPayslip = UploadPayslip;
