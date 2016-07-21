var cfg   = require('config');
var defer = require('config/defer').deferConfig;

module.exports = {

  auth: {
    scopes: {
      personal: defer( function (cfg) { return cfg.drive.personal.scopes.concat(cfg.mailbox.personal.scopes) } ),
      work:     defer( function (cfg) { return cfg.mailbox.work.scopes })
    },
    tokenFile: {
      personal: defer( function (cfg) { return "access_token_"+cfg.appName+"-personal.json" } ),
      work:     defer( function (cfg) { return "access_token_"+cfg.appName+"-work.json" } )
    }
  },

  drive: {
    personal: {
      scopes: ['https://www.googleapis.com/auth/drive.file']
    },
    payslipsFolderName: defer( function(cfg) { var d = new Date(); return "Test folder " + cfg.appName + " - " + d.toString() } )
  },

  gmailSearchCriteria: defer( function (cfg) { return 'newer_than:1d is:unread from:' + process.env.PERSONAL_EMAIL_ADDRESS + ' subject:"Document Uploaded"' } ),

  mailbox: {
    personal: {
      emailAddress: process.env.PERSONAL_EMAIL_ADDRESS,
      scopes: ['https://mail.google.com']
    },
    work: {
      emailAddress: process.env.OB_EMAIL_ADDRESS,
      scopes: ['https://mail.google.com']
    }
  },

  notificationEmail : {
    subject:   "Payslip Saver Report TEST"
  }

}
