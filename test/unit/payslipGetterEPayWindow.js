'use strict'

var cfg         = require('config'),
    chai        = require('chai'),
    nock        = require('nock'),
    {readFile}  = require('fs').promises,
    rewire      = require('rewire'),
    psg         = rewire('../../lib/payslipGetterEPayWindow.js');

/*
 * Set up chai
 */
chai.should();


var timeout = cfg.test.timeout.unit;

const epwHost = psg.__get__('_cfg.ePayWindow.baseUrl')

/*
 * The actual tests
 */

const epwNock = nock(epwHost)
.log(console.log)

async function stubGetLoginForm () {
  epwNock
  .get('/Login')
  .reply(200, await readFile('./test/data/login.html'))
}

function stubLoginFormSubmission ({
  body = "This logged in page should redirect",
  cookies = [
    'ASP.NET_SessionId=sess1234; path=/; secure; HttpOnly',
    '.AspNet.ApplicationCookie=appl1234; path=/; secure; HttpOnly'
  ],
  statusCode = 302
} = {}) {
  epwNock
  .post('/Login/MemberLogin')
  .reply(statusCode, body, {
    'Location': '/Dashboard',
    'Set-Cookie': cookies 
  })
}

function stubPayslipList ({
  body = {
    "total":2,
    "per_page":12,
    "data":[
      {"PayslipID":"{12345}","RunID":53,"CreateDate":"2019-11-25T10:13:00"},
      {"PayslipID":"{23456}","RunID":51,"CreateDate":"2019-10-29T20:57:00"}
    ]
  },
  statusCode = 200
} = {}) {  
  epwNock
  .get('/Payslips/Datatable')
  .query(true)
  .reply(statusCode, body)    
}

/**
 * @typedef {object} stubPayslipDownload
 * @property {number} payslipId
 * @property {number} statusCode
 */

/**
 * 
 * @param {stubPayslipDownload} param0
 */
function stubPayslipDownload ({
  payslipId = 100,
  statusCode = 200
} = {}) {  
  epwNock
  .get(`/Payslips/Download/${payslipId}`)
  .reply(statusCode, "This is a dud payslip")
}


function testBeforeAfter () {
  before(() => {if (!nock.isActive()) nock.activate()})
  afterEach(() => {nock.cleanAll()})
  after(() => { nock.restore()})
}

describe('payslipGetterEPayWindow', function () {

  this.timeout(timeout);

  describe('prepareForm', () => {

    const prepareForm = psg.__get__('prepareForm')
    testBeforeAfter()

    it('returns correctly prepared form details', async () => {
      await stubGetLoginForm()

      const formDetails = await prepareForm()
      
      formDetails.should.eql({
        action: '/Login/MemberLogin',
        inputs: {
          "__RequestVerificationToken":"abcd1234",
          "UserName":cfg.ePayWindow.username,
          "Password":cfg.ePayWindow.password
        }
      })
    });

    it('throws an error if the form isn\'t as expected', async () => {
      epwNock
      .get('/Login')
      .reply(200, 'This file makes no sense')

      try {
        const formDetails = await prepareForm()
      } catch (e) {
        e.message.should.eql('prepareForm: Login form not as expected')
      }   

    });

    it('throws an error if the page status is bad', async () => {
      epwNock
      .get('/Login')
      .reply(503, 'This file makes no sense')

      try {
        const formDetails = await prepareForm()
      } catch (e) {
        e.message.should.eql('503 - "This file makes no sense"')
      }   

    });
  });


  describe('doLogin', () => {

    const doLogin = psg.__get__('doLogin')

    testBeforeAfter()
    beforeEach(async () => {await stubGetLoginForm()})

    it('returns nothing if logged in correctly', async () => {
      stubLoginFormSubmission()
      await doLogin()
    });

    it('throws an error if the login cookies aren\'t found', async () => {
      stubLoginFormSubmission({cookies: ['uselessCookie=1234']})
      try {
        await doLogin()      
      } catch (e) {
        e.message.should.equal('Login failed: Cookies not found.')
      }
    });

    it('throws an error if the login cookies are empty', async () => {
      stubLoginFormSubmission({cookies: [
        'ASP.NET_SessionId=; path=/; secure; HttpOnly',
        '.AspNet.ApplicationCookie=appl1234; path=/; secure; HttpOnly'
      ]})
      try {
        await doLogin()      
      } catch (e) {
        e.message.should.equal('Login failed: Cookies not found.')
      }
    });
    it('throws an error if the login status is bad', async () => {
      stubLoginFormSubmission({body: 'Fake problem', statusCode: 503})
      try {
        await doLogin()      
      } catch (e) {
        e.message.should.equal('Login failed: Bad response: [503] Fake problem')
      }
    });

  });

  describe('getPayslipList', () => {

    const getPayslipList = psg.__get__('getPayslipList')

    testBeforeAfter()

    it('returns a valid payslip translation', async () => {
      stubPayslipList()
      const payslips = await getPayslipList()

      payslips.should.eql([
        {id:53,date:"2019-11-25"},
        {id:51,date:"2019-10-29"}
      ])
    });

    it('throws an error if the payslip data is invalid', async () => {
      stubPayslipList({body: "This is bad body"})
      try {
        await getPayslipList()      
      } catch (e) {
        e.should.be.an('error')
      }
    });

    it('throws an error if the request status is bad', async () => {
      stubPayslipList({body: "Fake problem", statusCode:503})
      try {
        await getPayslipList()      
      } catch (e) {
        e.message.should.equal('Error while getting payslip - StatusCodeError: 503 - "Fake problem"')
      }
    });

  });

  describe('downloadPaylsip', () => {

    const downloadPayslip = psg.downloadPayslip

    testBeforeAfter()

    it('downloads the file correctly if all is ok', async () => {
      stubPayslipDownload({payslipId:123})
      const fileLocation = await downloadPayslip({
        id: 123,
        date: '2019-01-01',
        suffix: 'bigCorp'
      })
      const fileContents = await readFile('/tmp/2019-01-01-bigCorp.pdf',{encoding: 'binary'})

      fileContents.should.equal('This is a dud payslip')
    });

    it('throws an error if the site is down', async () => {
      stubPayslipDownload({payslipId: 234, statusCode:503})

      try {
        const fileLocation = await downloadPayslip({
          id: 234,
          date: '2019-01-01',
          suffix: 'bigCorp'
        })
      } catch (e) {
        e.message.should.equal('503 - "This is a dud payslip"')
      }
    });

  });


});
