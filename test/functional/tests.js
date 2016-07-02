'use strict'

var cfg          = require('config'),
    chai         = require('chai'),
    gdriveModel  = require('gdrive-model'),
    gmailModel   = require('gmail-model'),
    rewire       = require('rewire');

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





var timeout = (1000*20)



/*
 * The actual tests
 */

describe('Running the script with the happy path', function () {

  this.timeout(timeout);

  var ps;


  var recipient = {
    receivedMailId: null
  };

  before(function (done) {

    personalGmail.sendMessage ({
      body    : "<empty email>",
      subject : cfg.test.triggerEmail.subject,
      to      : cfg.test.triggerEmail.to
    }, function (err, message) {
      if (err) throw new Error(err);

      try {

        ps = rewire('../index.js');

        var notifier = {
            isProcessingRequired : false
        };

        ps.__set__('notifier',notifier);


      } catch (e) {
        throw e
      } finally {
        done();
      }
    });
  })


  it('recognizes a trigger email has been received by the work address', function (done) {
    done()
  });

  /*
  it('sends a notification email to the recipient with a link to the uploaded payslip', function (done) {

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

  it('should mark the trigger email as read and processed', function (done) {
	done();
  });


  it('should upload the payslip to the recipient\'s google drive', function (done) {
	done();

  });
  */


  after(function (done) {

    // Trash the trigger email sent by the trigger sender
    workGmail.listMessages ({
      freetextSearch: 'from:me newer_than:1d subject:"' + cfg.test.triggerEmail.subject + '"',
      maxResults: 1
    }, function (err, messages) {

      if (err) throw new Error(err);
      done();
    })

    /*
    personalGmail.listMessages ({
      freetextSearch: 'from:me newer_than:1d subject:"' + cfg.test.triggerEmail.subject + '"',
      maxResults: 1
    }, function (err, messages) {

      if (err) throw new Error(err);

      personalGmail.trashMessages({
        messageIds: [messages[0].id]
      }, function (err, message) {
        if (err) { throw err }

        // Trash the trigger email received by the work mailbox

        workGmail.listMessages ({
          freetextSearch: 'to:me newer_than:1d subject:"' + cfg.test.triggerEmail.subject + '"',
          maxResults: 1
        }, function (err, messages) {

          if (err) throw new Error(err);

          workGmail.trashMessages({
            messageIds: [messages[0].id]
          }, function (err, message) {
            if (err) { throw err }

            // Trash the notificaiton email received by the personal mailbox from the work mailbox

            personalGmail.listMessages ({
              freetextSearch: 'to:me newer_than:1d subject:"' + cfg.notificationEmail.subject + '"',
              maxResults: 1
            }, function (err, messages) {

              if (err) throw new Error(err);

              personalGmail.trashMessages({
                messageIds: [messages[0].id]
              }, function (err, message) {
                if (err) { throw err }
		done();
              });
            });
          });
        });
      });
    });
      */


  })

});
