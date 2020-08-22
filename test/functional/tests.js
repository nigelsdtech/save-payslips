'use strict'

var cfg          = require('config'),
    chai         = require('chai'),
    driveUploader= require('../../lib/driveUploader'),
    gdriveModel  = require('gdrive-model'),
    gmailModel   = require('gmail-model'),
    payslipGetter = require(`../../lib/payslipGetter${cfg.payslipGetter}`),
    promisify    = require('util').promisify,
    rewire       = require('rewire'),
    sinon        = require('sinon'),
    SavePayslips = rewire('../../lib/SavePayslips.js');

/*
 * Set up chai
 */
chai.should();

const triggerEmailSubject = "This is a trigger email"

const cfgTS = cfg.triggerSender;
const triggerSenderGmail  = new gmailModel({
  appSpecificPassword: cfgTS.appSpecificPassword,
  clientSecretFile   : cfgTS.auth.clientSecretFile,
  emailsFrom         : cfgTS.emailsFrom,
  googleScopes       : cfgTS.auth.scopes,
  tokenDir           : cfgTS.auth.tokenFileDir,
  tokenFile          : cfgTS.auth.tokenFile,
  user               : cfgTS.user,
  name               : "triggerSender"
});

const cfgTC  = cfg.triggerChecker
const cfgTCa = cfgTC.auth
var triggerCheckerGmail = new gmailModel({
  clientSecretFile    : cfgTCa.clientSecretFile,
  googleScopes        : cfgTCa.scopes,
  tokenDir            : cfgTCa.tokenFileDir,
  tokenFile           : cfgTCa.tokenFile,
  name                : "triggerChecker"
});

const cfgRS = cfg.reporter.auth;
var reportSenderGmail = new gmailModel({
  clientSecretFile    : cfgRS.clientSecretFile,
  googleScopes        : cfgRS.scopes,
  tokenDir            : cfgRS.tokenFileDir,
  tokenFile           : cfgRS.tokenFile,
  name                : "reporter"
});

const cfgRR = cfg.reportRecipient.auth
var reportRecipientGmail = new gmailModel({
  clientSecretFile    : cfgRR.clientSecretFile,
  googleScopes        : cfgRR.scopes,
  tokenDir            : cfgRR.tokenFileDir,
  tokenFile           : cfgRR.tokenFile,
  name                : "reportRecipient"
});

const cfgDr = cfg.drive
const cfgDra = cfgDr.auth
var recipientGdrive = new gdriveModel({
  clientSecretFile    : cfgDra.clientSecretFile,
  googleScopes        : cfgDra.scopes,
  tokenDir            : cfgDra.tokenFileDir,
  tokenFile           : cfgDra.tokenFile
});

const timeout = (cfg.test.timeout.functional)
const emailWaitTime = (cfg.test.emailWaitTime || 5000)

/*
 * Some utility functions
 */


const sendMessage = promisify(triggerSenderGmail.sendMessage).bind(triggerSenderGmail)
/**
 * @description Sends out the initial trigger email
 * 
 * @returns {Promise}
 */
function sendTriggerMessage () {
  return sendMessage ({
    body    : "Start the payslip saver",
    subject : cfg.triggerEmail.subject,
    to      : cfgTC.email
  })
}


const createFile = promisify(recipientGdrive.createFile).bind(recipientGdrive)
/**
 * @description - Creates a payslips folder in gDrive
 * 
 * @returns {Promise} google folder
 */
function createTestFolder () {

  const d = new Date();
  const desc = `Test folder created by ${cfg.appName} on ${d.toString()}`;

  const newFolderDetails = createFile ({
    isFolder : true,
    resource: {
      description: desc,
      title: cfgDr.payslipsFolderName
    }
  })
  .then ((f) => {
    console.log(`Created test folder: ${JSON.stringify(f)}`);
    return f
  })

  return newFolderDetails
}


/**
 * @description find messages to delete and delete them
 * @returns {Promise}
 */
async function cleanInbox ({gmailAccount, freetextSearch} = {}) {

  const {name} = gmailAccount
  console.log(`(Mailbox-${name}) - getting messages`)

  // Personal account: Identify sent trigger email
  return await
    promisify(gmailAccount.listMessages).bind(gmailAccount)({freetextSearch})
    .catch((err) => {console.error(`(Mailbox-${name}) - Problem getting messages: ${err}`)})
    .then(async (messagesToTrash) => {

      console.log(`(Mailbox-${name}) - deleting ${messagesToTrash.length} messages`)

      const trashPromise = await promisify(gmailAccount.trashMessages).bind(gmailAccount)({
        messageIds: messagesToTrash.map((m) => {return m.id})  
      })

      console.log(`(Mailbox-${name}) - deleted ${messagesToTrash.length} messages`)
      return trashPromise
    })
    .catch((err) => {console.error(`(Mailbox-${name}) - Problem deleting messages: ${err}`)})
}


/*
 * The actual tests
 */

describe('Running the script when processing is required', function () {

  this.timeout(timeout);

  var payslipsFolderId, processedLabelId;

  before(() => {

    console.log('Running setups...')

    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

    return Promise.all([
      createTestFolder(),

      promisify(triggerCheckerGmail.getLabelId).bind(triggerCheckerGmail)({
        labelName: cfgTC.processedLabelName,
        createIfNotExists: true
      }),

      sendTriggerMessage()
    ])
    .then(([payslipsFolder, plId]) => {
      payslipsFolderId = payslipsFolder.id
      processedLabelId = plId
    })
    .then( () => {
      console.log('Setups complete.')
      return wait(emailWaitTime)
    })
    .then( async () => {
      return await SavePayslips()
    })
    .then( () => {
      return wait(emailWaitTime)
    })

  });


  it('uploads the payslip to the recipient\'s google drive under the Payslips folder', async () => {

    const retFiles = await promisify(recipientGdrive.listFiles).bind(recipientGdrive)({
      freetextSearch: `"${payslipsFolderId}" in parents`,
      spaces: "drive",
      retFields: ['files(mimeType,size)']
    })

    retFiles.length.should.not.equal(0);
    retFiles[0].mimeType.should.equal('application/pdf')
    retFiles[0].size.should.not.equal('0')
  });


  it('sends a notification email to the personal account with a link to the uploaded payslip', async () => {

    const msgs = await promisify(reportRecipientGmail.listMessages).bind(reportRecipientGmail)({
      freetextSearch: `is:unread to:me newer_than:1d subject:"${cfg.reporter.subject}"`,
      maxResults: 1
    })
    
    msgs.length.should.equal(1)

  });

  it('marks the trigger email as read and processed', async () => {

    const msgs = await promisify(triggerCheckerGmail.listMessages).bind(triggerCheckerGmail)({
      freetextSearch: `to:me newer_than:1d subject:"${cfg.triggerEmail.subject}"`,
      maxResults: 1,
      retFields: ['messages(id)']
    })

    msgs.length.should.equal(1)

    const msg = await promisify(triggerCheckerGmail.getMessage).bind(triggerCheckerGmail)({
      messageId: msgs[0].id,
      retFields: ['labelIds']
    })
    
    msg.should.have.property('labelIds');
    msg.labelIds.should.include(processedLabelId);
    msg.labelIds.should.not.include('UNREAD');

  });



  after(async () => {

    // Delete trigger message from sender
    // Delete trigger message received
    // Delete the label
    // Delete report email sent by sender
    // Delete report email received
    // Delete created payslips folder

    const subjectAndNewerTrig = `subject:"${cfg.triggerEmail.subject}" newer_than:1d`
    const subjectAndNewerRpt = `subject:"${cfg.reporter.subject}" newer_than:1d`

    return await Promise.all([
      cleanInbox({
        gmailAccount: triggerSenderGmail,
        freetextSearch: `is:sent from:me to:${cfg.triggerChecker.email} ${subjectAndNewerTrig}`
      }),

      cleanInbox({
        gmailAccount: triggerCheckerGmail,
        freetextSearch: `to:me ${subjectAndNewerTrig}"`
      }),

      // Delete the processed label
      promisify(triggerCheckerGmail.deleteLabel).bind(triggerCheckerGmail)({labelId: processedLabelId}),

        
      cleanInbox({
        gmailAccount: reportSenderGmail,
        freetextSearch: `is:sent from:me to:${cfg.reporter.to} ${subjectAndNewerRpt}`
      }),

      cleanInbox({
        gmailAccount: reportRecipientGmail,
        freetextSearch: `is:inbox from:${cfg.reporter.user} ${subjectAndNewerRpt}`
      }),
   
      // Delete the created payslips folder
      promisify(recipientGdrive.trashFiles).bind(recipientGdrive)({
        fileIds: [payslipsFolderId],
        deletePermanently: true
      })
    ])

  })
});


describe('Running the script when no processing is required', function () {

  this.timeout(timeout)

  var stub;

  before(async () => {
    stub = sinon.stub(payslipGetter,'getKnownPayslips').rejects("Should not reach here");
    await SavePayslips();
  });


  it('shouldn\'t try to download the payslip', () => {stub.callCount.should.equal(0)});

  after(() => {stub.reset(); stub.restore();})
});


describe('Running the script when there is an error', function () {

  this.timeout(timeout)

  var stubps, stubdr;

  before(async () => {
    stubps = sinon.stub(payslipGetter,'getKnownPayslips').rejects("Fake error from payslipGetter");
    stubdr = sinon.stub(driveUploader,'getKnownPayslips').rejects("Fake error from driveUploader");

    console.log('Running setups...')

    await sendTriggerMessage()

    console.log('Setups complete.')

    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

    await wait(emailWaitTime) 
    
    await SavePayslips()

    await wait(emailWaitTime)

    return
  });

  it('sends an error email to the recipient account', async () => {

    const msgs = await promisify(reportRecipientGmail.listMessages).bind(reportRecipientGmail)({
      freetextSearch: `is:unread to:me newer_than:1d subject:"${cfg.reporter.subject} ERROR" "Fake error from"`,
      maxResults: 1
    })
    
    msgs.length.should.equal(1)

  });

  after(async () => {
    stubps.reset(); stubps.restore();
    stubdr.reset(); stubdr.restore();

    return await Promise.all([
      cleanInbox({
        gmailAccount: triggerSenderGmail,
        freetextSearch: `is:sent to:${cfg.triggerChecker.email} newer_than:1d subject:"${cfg.triggerEmail.subject}"`
      }),

      cleanInbox({
        gmailAccount: triggerCheckerGmail,
        freetextSearch: `to:me newer_than:1d subject:"${cfg.triggerEmail.subject}"`
      }),
        
      cleanInbox({
        gmailAccount: reportSenderGmail,
        freetextSearch: `is:sent from:me to:${cfg.reporter.to} newer_than:1d subject:"${cfg.reporter.subject} ERROR" "Fake error from"`
      }),

      cleanInbox({
        gmailAccount: reportRecipientGmail,
        freetextSearch: `is:unread to:me newer_than:1d subject:"${cfg.reporter.subject} ERROR" "Fake error from"`
      })
    ])
  })
});
