'use strict'

var cfg          = require('config'),
    chai         = require('chai'),
    gdriveModel  = require('gdrive-model'),
    gmailModel   = require('gmail-model'),
    rewire       = require('rewire'),
    sinon        = require('sinon'),
    SavePayslips = rewire('../../lib/SavePayslips.js');

/*
 * Set up chai
 */
chai.should();



/*
 * Work mailbox
 */

var workGmail = new gmailModel({
  appSpecificPassword : cfg.mailbox.work.password,
  clientSecretFile    : cfg.auth.clientSecretFile,
  emailsFrom          : cfg.mailbox.work.emailsFrom,
  googleScopes        : cfg.auth.scopes.work,
  name                : cfg.mailbox.work.name,
  tokenDir            : cfg.auth.tokenFileDir,
  tokenFile           : cfg.auth.tokenFile.work,
  user                : cfg.mailbox.work.user
});

/*
 * Personal mailbox
 */

var personalGmail = new gmailModel({
  appSpecificPassword : cfg.mailbox.personal.password,
  clientSecretFile    : cfg.auth.clientSecretFile,
  emailsFrom          : cfg.mailbox.personal.emailsFrom,
  googleScopes        : cfg.auth.scopes.personal,
  name                : cfg.mailbox.personal.name,
  tokenDir            : cfg.auth.tokenFileDir,
  tokenFile           : cfg.auth.tokenFile.personal,
  user                : cfg.mailbox.personal.user
});

/*
 * Personal gdrive
 */

var personalGdrive = new gdriveModel({
  googleScopes        : cfg.auth.scopes.personal,
  clientSecretFile    : cfg.auth.clientSecretFile,
  tokenDir            : cfg.auth.tokenFileDir,
  tokenFile           : cfg.auth.tokenFile.personal
});




var timeout = (1000*60)


/*
 * Some utility functions
 */

function sendTriggerMessage (cb) {

  personalGmail.sendMessage ({
    body    : "Start the payslip saver",
    subject : "Document Uploaded",
    to      : cfg.mailbox.work.emailAddress
  }, function (err, message) {

    if (err) { cb(err); return null; }

    cb(null,message);
  })

}


function createTestFolder (cb) {

  var d = new Date();
  var desc =  "Test folder created by " + cfg.appName + " on " + d.toString();
  var payslipsFolderName = cfg.drive.payslipsFolderName;

  personalGdrive.createFile ({
    isFolder : true,
    resource: {
      description: desc,
      title: payslipsFolderName
    }
  }, function (err, resp) {

    if (err) { cb(err); return null; }

    cb(null,resp);
  })

}



/*
 * The actual tests
 */

describe('Running the script when processing is required', function () {

  this.timeout(timeout);

  var payslipsFolderId, processedLabelId;

  before(function (done) {

    createTestFolder ( function (err, folder) {
      if (err) throw new Error(err);
      payslipsFolderId = folder.id;

      workGmail.getLabelId ({
        labelName: cfg.processedLabelName,
        createIfNotExists: true
      }, function (err, labelId) {
        if (err) throw new Error(err);
        processedLabelId=labelId

        sendTriggerMessage ( function (err, msg) {
          if (err) throw new Error(err);
          setTimeout(SavePayslips, 2000, done);
        });
      });
    });
  });


  it('uploads the payslip to the recipient\'s google drive under the Payslips folder', function (done) {
    personalGdrive.listFiles({
      freetextSearch: '"' + payslipsFolderId + '" in parents',
      spaces: "drive"
    }, function (err, retFiles) {
      retFiles.length.should.equal(1);
      retFiles[0].mimeType.should.equal('application/pdf')
      done();
    });
  });


  it('sends a notification email to the personal account with a link to the uploaded payslip', function (done) {

    personalGmail.listMessages({
      freetextSearch: 'is:unread from:me to:me newer_than:1d subject:"' + cfg.notificationEmail.subject + '"',
      maxResults: 1
    }, function (err, messages) {
      if (err) { throw err }

      messages.length.should.equal(1)
      done();
    })

  });

  it('marks the trigger email as read and processed', function(done) {

    workGmail.listMessages({
      freetextSearch: 'from:' + cfg.mailbox.personal.emailAddress + ' to:me newer_than:1d subject:"Document Uploaded"',
      maxResults: 1
    }, function (err, messages) {
      if (err) { throw err }
      if (messages.length == 0) { throw new Error ('Trigger email not found') }

      workGmail.getMessage({ messageId: messages[0].id }, function (err, message) {

        if (err) { throw err }
        message.should.have.property('labelIds');
        message.labelIds.should.include(processedLabelId);
        message.labelIds.should.not.include('UNREAD');
	done();
      })

    })
  });



  after(function (done) {

    // Delete trigger message from sender
    // Delete trigger message received
    // Delete created payslips folder
    // Delete notification email sent by work address
    // Delete notification email received by personal address

    var workGmailMessagesToTrash     = [];
    var personalGmailMessagesToTrash = [];

    // Personal account: Identify sent trigger email
    personalGmail.listMessages ({
      freetextSearch: 'is:sent from:me to:' + cfg.mailbox.work.emailAddress + ' newer_than:1d subject:"Document Uploaded"'
    }, function (err, messages) {
      if (err) console.error('Error: Personal account: Identify sent trigger email: ' + err);
      for (var i = 0; i < messages.length; i++ ) { personalGmailMessagesToTrash.push(messages[i].id) }

      // Work account: Identify the trigger email received
      workGmail.listMessages ({
        freetextSearch: 'from:' + cfg.mailbox.personal.emailAddress + ' to:me newer_than:1d subject:"Document Uploaded"'
      }, function (err, messages) {
        if (err) console.error('Error: Work account: Identify received trigger email: ' + err);
        for (var i = 0; i < messages.length; i++ ) { workGmailMessagesToTrash.push(messages[i].id); }

        // Delete the created payslips folder
        personalGdrive.trashFiles ({
          fileIds: [payslipsFolderId],
          deletePermanently: true
        }, function (err, reps) {

          // Personal account: Identify the notification email sent from the Pi to myself
          personalGmail.listMessages ({
            freetextSearch: 'is:sent from:me to:me newer_than:1d subject:"' + cfg.notificationEmail.subject + '"'
          }, function (err, messages) {
            if (err) console.error('Error: Work account: Identify the notification email sent: ' + err);
            for (var i = 0; i < messages.length; i++ ) { personalGmailMessagesToTrash.push(messages[i].id) }

	    // Personal account: Send off the actual deletions
            personalGmail.trashMessages ({
              messageIds: personalGmailMessagesToTrash
            }, function (err, messages) {
              if (err) console.error('Error: Personal account: Send off the actual deletions - %s - %s', err, personalGmailMessagesToTrash);

	      // Work account: Send off the actual deletions
              workGmail.trashMessages ({
                messageIds: workGmailMessagesToTrash
              }, function (err, messages) {
                if (err) console.error('Error: Work account: Send off the actual deletions - %s - %s', err, workGmailMessagesToTrash);

                // Delete the processed label
                workGmail.deleteLabel ({
                  labelId: processedLabelId
                }, function (err) {
                  if (err) console.error('Error deleting processed label - %s', err);
                  done()
                });
              });
            });
          });
	});
      });
    });
  });

});


describe('Running the script when no processing is required', function () {

  this.timeout(timeout)

  var spyCb = sinon.spy();
  var restore;

  before(function (done) {
    restore = SavePayslips.__set__('payslipGetter.downloadPayslip', function (p,cb) {spyCb(); cb("Should not reach here")});
    SavePayslips(done);
  });


  it('shouldn\'t try to download the payslip', function (done) {
    spyCb.callCount.should.equal(0);
    done();
  });

  after(function (done) {
    restore();
    done();
  })
});
