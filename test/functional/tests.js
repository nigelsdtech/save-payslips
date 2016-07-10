'use strict'

var cfg          = require('config'),
    chai         = require('chai'),
    gdriveModel  = require('gdrive-model'),
    gmailModel   = require('gmail-model'),
    rewire       = require('rewire'),
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
    subject : cfg.test.triggerEmail.subject,
    to      : cfg.test.triggerEmail.to
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

describe('Running the script with the happy path', function () {

  this.timeout(timeout);

  var payslipsFolderId;

  before(function (done) {

    createTestFolder ( function (err, folder) {
      if (err) throw new Error(err);
      payslipsFolderId = folder.id;

      sendTriggerMessage ( function (err, msg) {
        if (err) throw new Error(err);
        try { SavePayslips(done); }
        catch (e) { throw e }
      });
    });
  });


  it('uploads the payslip to the recipient\'s google drive under the Payslips folder', function (done) {
    personalGdrive.listFiles({
      freetextSearch: "fullText contains '"+cfg.get.payslipsFolderName+"'",
      spaces: "drive"
    }, function (err, retFiles) {
      retFiles.length.should.equal(1);
      retFiles[0].parents[0].id.should.equal(payslipsFolderId)
      done();
    });
  });

  /*
  it('sends a notification email to the personal account with a link to the uploaded payslip', function (done) {

    personalGmail.listMessages({
      freetextSearch: 'is:unread newer_than:1d subject:"' + cfg.notificationEmail.subject + '"',
      maxResults: 1
    }, function (err, messages) {
      if (err) { throw err }

      messages.length.should.equal(1)

      personalGmail.getMessage({
        messageId: messages[0].id
      }, function (err, message) {
        if (err) { throw err }

	done();
      });
    }
  });

  it('marks the trigger email as read and processed', function (done) {
	done();
  });



  */


  after(function (done) {

    // Delete trigger message from sender
    // Delete trigger message received
    // Delete created payslips folder
    // Delete notification email sent by work address
    // Delete notification email received by personal address

    var workGmailMessagesToTrash     = [];
    var personalGmailMessagesToTrash = [];

    // Trash the trigger email sent by the trigger sender
    personalGmail.listMessages ({
      freetextSearch: 'is:sent from:me to:' + cfg.test.triggerEmail.to + ' newer_than:1d subject:"' + cfg.test.triggerEmail.subject + '"'
    }, function (err, messages) {
      if (err) console.error('Error trashing trigger email sent by trigger sender');
      for (var i = 0; i < messages.length; i++ ) { personalGmailMessagesToTrash.push(messages[i].id) }

      // Trash the trigger email received
      workGmail.listMessages ({
        freetextSearch: 'from:' + cfg.mailbox.personal.emailAddress + ' to:me newer_than:1d subject:"' + cfg.test.triggerEmail.subject + '"'
      }, function (err, messages) {
        if (err) console.error('Error trashing trigger email received');
        for (var i = 0; i < messages.length; i++ ) { workGmailMessagesToTrash.push(messages[i].id) }

        // Delete the created payslips folder
        personalGdrive.trashFiles ({
          fileIds: [payslipsFolderId],
          deletePermanently: true
        }, function (err, reps) {

          // Trash the notification email sent by work address
          workGmail.listMessages ({
            freetextSearch: 'is:sent from:me to:' + cfg.mailbox.personal.emailAddress + ' newer_than:1d subject:"' + cfg.notificationEmail.subject + '"'
          }, function (err, messages) {
            if (err) console.error('Error trashing notification email sent by work address');
            for (var i = 0; i < messages.length; i++ ) { workGmailMessagesToTrash.push(messages[i].id) }

            // Trash the notification email received by personal address
            personalGmail.listMessages ({
              freetextSearch: 'from:' + cfg.mailbox.work.emailAddress + ' to:me newer_than:1d subject:"' + cfg.notificationEmail.subject + '"'
            }, function (err, messages) {
              if (err) console.error('Error trashing notification received by personal address');
              for (var i = 0; i < messages.length; i++ ) { personalGmailMessagesToTrash.push(messages[i].id) }

	      // Send off the actual deletions - personal
              personalGmail.trashMessages ({
                messageIds: personalGmailMessagesToTrash
              }, function (err, messages) {
                if (err) console.error('Error actually deleting personal emails - %s - %s', err, personalGmailMessagesToTrash);

	        // Send off the actual deletions - work
                workGmail.trashMessages ({
                  messageIds: workGmailMessagesToTrash
                }, function (err, messages) {
                  if (err) console.error('Error actually deleting work emails - %s - %s', err, workGmailMessagesToTrash);
                  done();
                }); // Send off the actual deletions - work
              }); // Send off the actual deletions - personal
            }); // Trash the notification email received by personal address
          }); // Trash the notification email sent by work address
	}); // Delete the created payslips folder
      }); // Trash the trigger email received
    }); // Trash the trigger email sent by the trigger sender
  });

});
