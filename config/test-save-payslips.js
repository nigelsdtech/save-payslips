var cfg   = require('config');
var defer = require('config/defer').deferConfig;

module.exports = {

  appName: process.env.npm_package_config_appName + '-test',

  auth : {
    scopes: {
      personal: defer( function (cfg) { return '' + cfg.drive.personal.scopes + ' ' + cfg.mailbox.personal.scopes} ),
      work:     defer( function (cfg) { return cfg.mailbox.work.scopes } )
    },
    tokenFile: {
      personal: defer( function (cfg) { return "access_token_"+cfg.appName+"-personal.json" } ),
      work:     defer( function (cfg) { return "access_token_"+cfg.appName+"-work.json" } )
    }
  },

  drive: {
    personal: {
      scopes: "https://www.googleapis.com/auth/drive.file"
    },
    payslipsFolderName: defer( function(cfg) { var d = new Date(); return "Test folder " + cfg.appName + " - " + d.toString() } )
  },

  gmailSearchCriteria: defer( function (cfg) { return "newer_than:1d is:unread from:" + cfg.test.triggerEmail.from  + " subject:'" +  cfg.test.triggerEmail.subject + "'" } ),

  mailbox: {
    personal: {
      emailAddress: process.env.PERSONAL_EMAIL,
      scopes: 'https://mail.google.com'
    },
    work: {
      emailAddress: process.env.OB_EMAIL,
      scopes: 'https://mail.google.com'
    }
  },

  notificationEmail : {
    stubEmail: true,
    subject:   "Payslip Saver Report TEST"
  },


  test: {
    triggerEmail: {
      to: process.env.OB_EMAIL_ADDRESS,
      subject: defer( function (cfg) { return cfg.appName+' test trigger' } )
    }
  }


} 
