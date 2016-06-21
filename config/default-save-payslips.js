var cfg   = require('config');
var defer = require('config/defer').deferConfig;

module.exports = {

  mailbox: {
    name:   'Work Primary',
    userId: 'me'
  },

  email : {
    stubEmail: true,
    user:      process.env.PERSONAL_GMAIL_USERNAME,
    password:  process.env.PERSONAL_APP_SPECIFIC_PASSWORD,
    host:      process.env.GMAIL_SMTP_SERVER,
    ssl:       true,
    from:      "Nigel's Raspberry Pi <"+process.env.PERSONAL_EMAIL+">",
    to:        process.env.OB_DISPLAY_NAME+" <"+process.env.OB_EMAIL_ADDRESS+">",
    subject:   "Payslip Saver Report %s"
  },


  gmailSearchCriteria: "newer_than:21d from:Payslip4u subject:'Document Uploaded'",
  processedLabelName:  defer( function (cfg) { return cfg.appName+'-Processed' } ),
  applyLabelToProcessedEmail: false,
  markEmailAsRead: false

} 
