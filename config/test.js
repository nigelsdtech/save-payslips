var cfg   = require('config');
var defer = require('config/defer').deferConfig;

module.exports = {

  test: {
    commonStubs: {
      'log': {
        debug:    console.log,
        error:    console.error,
        info:     console.log,
        setLevel: function () {}
      },
      'log4js': {
        configure: function () {},
        getLogger: function () {}
      }
    },
    timeout: {
      unit: (1000*2),
      functional: (1000*30)
    }
  },

  drive: {
    payslipsFolderName: "Payslips-test"
  },

  triggerEmail: {
    subject: "This is a trigger email"
  },

  triggerSender: {
    auth: {
      scopes: ['https://www.googleapis.com/auth/gmail.modify'],
      clientSecretFile: defer( function (cfg) { return cfg.auth.clientSecretFile } ),
      tokenFile:        defer( function (cfg) { return `${cfg.auth.tokenFile}`.replace('.json', `-triggerSender.json`) } ),
      tokenFileDir:     defer( function (cfg) { return cfg.auth.credentialsDir } )
    },    
    appSpecificPassword : "OVERRIDE_ME",
    emailsFrom          : "Test trigger sender",
    name                : 'testTriggerSender',
    user                : "OVERRIDE_ME"
  },

  triggerChecker: {
    email: "OVERRIDE_ME",
    gmailSearchCriteria: defer( function (cfg) { return `from:"${cfg.triggerSender.emailsFrom}" subject:"${cfg.triggerEmail.subject}" newer_than:1d'`} ),
    processedLabelName:  defer( function (cfg) { return `${cfg.instanceFullName}-Processed` } )
  },

  reporter: {
    auth: {
      scopes: ['https://www.googleapis.com/auth/gmail.modify'],
      clientSecretFile: defer( function (cfg) { return cfg.auth.clientSecretFile } ),
      tokenFile:        defer( function (cfg) { return `${cfg.auth.tokenFile}`.replace('.json', `-reporter.json`) } ),
      tokenFileDir:     defer( function (cfg) { return cfg.auth.credentialsDir } )
    }
  },

  reportRecipient: {
    auth: {
      scopes: ['https://www.googleapis.com/auth/gmail.modify'],
      clientSecretFile: defer( function (cfg) { return cfg.auth.clientSecretFile } ),
      tokenFile:        defer( function (cfg) { return `${cfg.auth.tokenFile}`.replace('.json', `-reporterReceiver.json`) } ),
      tokenFileDir:     defer( function (cfg) { return cfg.auth.credentialsDir } )
    }
  },
}
