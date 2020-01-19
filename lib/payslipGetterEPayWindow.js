"use strict"

var cfg          = require('config'),
    cheerio      = require('cheerio'),
    log4js       = require('log4js'),
    request      = require('request-promise-native'),
    {writeFile}  = require('fs').promises;



// logs

log4js.configure(cfg.log.log4jsConfigs);

var log = log4js.getLogger(cfg.log.appName);
log.setLevel(cfg.log.level);


// Some default configs
const _cfg = {
    ePayWindow : {
      baseUrl: 'https://www.myepaywindow.com',
      forever: true,
      gzip: true,
      loginForm: {
        passwordField : 'Password',
        usernameField : 'UserName'
      },
      loggedInCookieNames : ['.AspNet.ApplicationCookie','ASP.NET_SessionId']
    },
    reqTimeout: (1000*10),
    userAgent: 'Mozilla/5.0 (Linux; Android 4.4.2; Nexus 4 Build/KOT49H) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/48.0.2564.23 Mobile Safari/537.36'
  }

// Setup the request defaults
const ePayWindowRequest = request.defaults({
    baseUrl : _cfg.ePayWindow.baseUrl,
    timeout : _cfg.reqTimeout,
    followAllRedirects : false,
    jar : true,
    headers: {
        'Upgrade-Insecure-Requests' : '1',
        'User-Agent'                : _cfg.userAgent
    },
    gzip: true
});

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

    // Prepare the form
    const preparedForm = await prepareForm();

    log.info('Logging in to MyEPaySlip...')

    // Submit it and check for the cookies
    return await ePayWindowRequest
    .post({
        uri: preparedForm.action,
        form: preparedForm.inputs,
        resolveWithFullResponse: true,
        simple: false
    })
    .then((response) => {
        if ([200, 302].indexOf(response.statusCode) == -1) {
            const errMsg = `Bad response: [${response.statusCode}] ${response.body}`
            log.error(errMsg)
            throw new Error(errMsg);
        }

        log.debug('Login form full response:')
        log.debug(response.headers)

        const cookies = response.headers['set-cookie']
        if (typeof cookies === 'undefined') {
            log.error(`Not logged in: Cookies = ${cookies}`)
            throw new Error('Could not log in.')
        }

        const foundCookies = cookies
        .map((cookie, i) => {
            const cookieDetails = cookie.split(';')
            const [cookieName, cookieValue] = cookieDetails[0].split('=')
            return {name: cookieName, value: cookieValue}
        })
        log.debug(`Cookies = ${JSON.stringify(foundCookies)}`)


        // Check that the login cookies were set
        for (var loggedInCookieName of _cfg.ePayWindow.loggedInCookieNames) {  

            log.debug(`Searching for ${loggedInCookieName}`)
            const foundVal = foundCookies.find((c) => {
                log.debug(`--> Testing against ${JSON.stringify(c)}`);
                return (c.name === loggedInCookieName && c.value != '')
            })

            if (typeof foundVal === 'undefined') {
                log.error(`Cookie ${loggedInCookieName} not found in: - ${cookies}`)
                throw new Error('Cookies not found.')
            }
        }
    })
    .catch((e) => {
        const reason = new Error(`Login failed: ${e.message}`)
        log.error(reason)
        log.error(e.stack)
        throw reason
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

/**
 * @typedef {object} loginForm
 * @param {string} action - uri to which the form will submit
 * @param {object} inputs - object where the key/value represent form fields and values
 */
/**
 * Get the login form and prepare the fields to submit (username, password, etc)
 * 
 * @returns {loginForm}
 */
async function prepareForm() {
    
    const errMsg = 'prepareForm: Login form not as expected'

    log.info('Getting login form...')

    // Go to the login site
    const loginForm = await ePayWindowRequest.get({
        uri: '/Login',
        transform: (body) => {return cheerio.load(body)('form')}
    })

    const action = (() => {
        try {
            const a = loginForm.attr().action
            return a
        } catch (e) {
            log.error(errMsg)
            log.error(e)
            log.error(loginForm)
            throw new Error(errMsg)
        }
    })()
    

    // Get all the form inputs and fill them out with the intended fields
    const fInputs = loginForm
    .find('input')
    .get()
    .reduce((accumulator, el) => {
        const name = el.attribs.name

        switch (name) {
            case _cfg.ePayWindow.loginForm.usernameField:
                accumulator[name] = cfg.ePayWindow.username;
                break;
            case _cfg.ePayWindow.loginForm.passwordField:
                accumulator[name] = cfg.ePayWindow.password;
                break;
            default:
                accumulator[name] = el.attribs.value
        }

        return accumulator
    }, {})

    log.debug(`Prepared form with action '${action} and inputs ${JSON.stringify(fInputs)}`)
    return {
        action: action,
        inputs: fInputs
    }
}

module.exports = {
    downloadPayslip: downloadPayslip,
    getKnownPayslips: getKnownPayslips
}