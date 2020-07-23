"use strict"

const
    cfg          = require('config'),
    log4js       = require('log4js'),
    siteScraper  = require('./SiteScraper'),
    {writeFile}  = require('fs').promises;



// logs

log4js.configure(cfg.log.log4jsConfigs);

var log = log4js.getLogger(cfg.log.appName);
log.setLevel(cfg.log.level);

// Some default configs
const _cfg = siteScraper.createConfigs({
    providerSite: {
        baseUrl: 'https://www.myepaywindow.com',
        loginForm: {
            password: cfg.ePayWindow.password,
            username: cfg.ePayWindow.username,
            uri: '/Login'
        }
    }
})

// Setup the request defaults
const ePayWindowRequest = siteScraper.getRequester({
    baseUrl: _cfg.providerSite.baseUrl
})

/**
 * @typedef {object} downloadPayslipData
 * @property {number} id
 * @property {string} date - in the format "yyyy-MM-dd"
 * @property {string} suffix
 */

/**
 * 
 * @param {downloadPayslipData} params
 * 
 * @returns {string} - Location to which the file was downloaded
 */
async function downloadPayslip({id, date, suffix} = {}) {

    const downloadedFileLocation = `/tmp/${date}-${suffix}.pdf`;

    await ePayWindowRequest.get({
        uri: `/Payslips/Download/${id}`,
        encoding: 'binary'
    })
    .then(body => { return writeFile(downloadedFileLocation,body,{encoding:'binary'}) } )

    return downloadedFileLocation
}

/**
 * @typedef {object} payslip
 * @param {number} id
 * @param {string} date - of the format 'yyyy-MM-dd'
 */
/**
 * Get a list of available payslips
 * @returns {Promise<payslip>[]}
 */
async function getKnownPayslips() {
    await doLogin()
    return await getPayslipList()
}

/**
 * Logs in to myepayslip. Doesn't return any values but it warms up the cookie jar
 * with login cookies.
 */
async function doLogin() {

    const {password,passwordField,uri,username,usernameField} = _cfg.providerSite.loginForm

    await siteScraper.doLoginWithCookies({
        log,
        loginFormUri: uri,
        loggedInCookieNames: _cfg.providerSite.loggedInCookieNames,
        password,
        passwordField,
        username,
        usernameField,
        requester: ePayWindowRequest
    })
}

/**
 * Get a list of payslips from myepayslip (you should already have a login cookie)
 * 
 * @returns {Promise<payslip[]>}
 */
async function getPayslipList() {

    // Get the payslips
    return await ePayWindowRequest.get({
        uri: '/Payslips/Datatable',
        json: true,
        qs: {
            sort: "RunDate|desc",
            page: 1,
            per_page: 5 
        }
    })
    .then((resp) => {
        return resp
        .data
        .map((payslip) => {
            return {
                id: payslip.RunID,
                date: payslip.CreateDate.split('T')[0]
            }
        })
    })
    .catch((err) => {
        const errMsg = 'Error while getting payslip - ' + err
        log.error('Error while getting payslip - ' + err)
        log.error(err.stack)
        throw new Error(errMsg)
    })

}

module.exports = { downloadPayslip, getKnownPayslips }
