"use strict"


const 
    cheerio      = require('cheerio'),
    request      = require('request-promise-native')


/**
 * 
 * @typedef loginForm
 *
 * @param {String} loginForm.password
 * @param {String} loginForm.passwordField
 * @param {String} loginForm.uri
 * @param {String} loginForm.username
 * @param {String} loginForm.usernameField
 */

/**
 * 
 * @typedef providerSite
 * 
 * @param {String} baseUrl
 * @param {loginForm} loginForm
 * @param {String[]} loggedInCookieNames
 */

/**
 * 
 * @typedef configParams
 * 
 * @param {providerSite} providerSite
 */

/**
 * 
 * @param {configParams} params
 */
function createConfigs ({
    providerSite: {
        baseUrl,
        loginForm: {
            password,
            passwordField = 'Password',
            uri,
            username = "SET_ME_UP",
            usernameField = 'UserName'
        },
        loggedInCookieNames = ['.AspNet.ApplicationCookie', 'ASP.NET_SessionId']
    }
} = {}) {

    return {
        providerSite: {
            baseUrl,
            loginForm: {
                password,
                passwordField,
                uri,
                username,
                usernameField
            },
            loggedInCookieNames
        }
    }
}

/**
 * 
 * @typedef connection
 * 
 * @param {Number} reqTimeout
 * @param {String} userAgent
 */

function getRequester ({
    baseUrl,
    reqTimeout = (1000 * 10),
    userAgent = 'Mozilla/5.0 (Linux; Android 4.4.2; Nexus 4 Build/KOT49H) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/48.0.2564.23 Mobile Safari/537.36'
}) {
    return request.defaults({
        baseUrl : baseUrl,
        timeout : reqTimeout,
        followAllRedirects : false,
        jar : true,
        headers: {
            'Upgrade-Insecure-Requests' : '1',
            'User-Agent'                : userAgent
        },
        gzip: true
    });
}


/**
 * 
 * @returns {Promise<void>}
 */
async function doLoginWithCookies({
    log,
    loginFormUri,
    loggedInCookieNames,
    password,
    passwordField,
    username,
    usernameField,
    requester
}) {

    // Prepare the form
    const preparedForm = await prepareForm({
        log,
        loginFormUri,
        password,
        passwordField,
        username,
        usernameField,
        requester
    });

    log.info('Logging in to site...')

    // Submit it and check for the cookies
    return await requester
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
        for (var loggedInCookieName of loggedInCookieNames) {  

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
 * @typedef {object} loginFormInputs
 * @param {string} action - uri to which the form will submit
 * @param {object} inputs - object where the key/value represent form fields and values
 */
/**
 * Get the login form and prepare the fields to submit (username, password, etc)
 * 
 * @returns {loginFormInputs}
 */
async function prepareForm ({
    log,
    loginFormUri,
    password,
    passwordField,
    username,
    usernameField,
    requester
} = {}) {
    
    const errMsg = 'prepareForm: Login form not as expected'

    log.info('Getting login form...')

    // Go to the login site
    const loginForm = await requester.get({
        uri: loginFormUri,
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
            case usernameField:
                accumulator[name] = username;
                break;
            case passwordField:
                accumulator[name] = password;
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

module.exports = {doLoginWithCookies, createConfigs, getRequester}