var cfg   = require('config');
var defer = require('config/defer').deferConfig;

module.exports = {

  auth: {
    credentialsDir:   process.env.HOME+"/.credentials",
    clientSecretFile: defer( function (cfg) { return cfg.auth.credentialsDir+"/client_secret.json" } ),
    scopes: {
      personal: defer( function (cfg) { return cfg.drive.personal.scopes } ),
      work:     defer( function (cfg) { return cfg.mailbox.work.scopes } )
    },
    tokenFile: {
      personal: defer( function (cfg) { return "access_token_"+cfg.appName+"-personal.json" } ),
      work:     defer( function (cfg) { return "access_token_"+cfg.appName+"-work.json" } )
    },
    tokenFileDir: defer( function (cfg) { return cfg.auth.credentialsDir } )
  },

  drive: {
    personal: {
      scopes: 'https://www.googleapis.com/auth/drive'
    }
  },

  mailbox: {
    personal: {
      emailsFrom: "Nigel's Raspberry Pi <"+process.env.PERSONAL_EMAIL+">",
      name: 'Personal',
      user: process.env.PERSONAL_GMAIL_USERNAME,
      password:  process.env.PERSONAL_APP_SPECIFIC_PASSWORD
    },
    work: {
      name: 'Work Primary',
      scopes: 'https://www.googleapis.com/auth/gmail.modify'
    }
  },

  notificationEmail : {
    stubEmail: false,
    to:        process.env.PERSONAL_DISPLAY_NAME+" <"+process.env.PERSONAL_EMAIL_ADDRESS+">",
    subject:   "Payslip Saver Report %s"
  },

  portus : {
    username: process.env.PORTUS_USERNAME,
    password: process.env.PORTUS_PASSWORD
  },

  gmailSearchCriteria: "newer_than:7d from:Payslip4u subject:'Document Uploaded'",
  processedLabelName:  defer( function (cfg) { return cfg.appName+'-Processed' } ),
  applyLabelToProcessedEmail: true,
  markEmailAsRead: true

} 
