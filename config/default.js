var cfg   = require('config');
var defer = require('config/defer').deferConfig;

module.exports = {

  instanceFullName: defer( function (cfg) {
    const out = process.env.npm_package_config_appName
      + "-" + process.env.NODE_APP_INSTANCE
      + ( (typeof process.env.NODE_ENV == "undefined" || ["", "production"].indexOf(process.env.NODE_ENV) >= 0)? "" : `-${process.env.NODE_ENV}` )
    return out
  } ),

  auth: {
    credentialsDir:   "./credentials",
    clientSecretFile: defer( function (cfg) { return cfg.auth.credentialsDir+"/client_secret.json" } ),
    tokenFileDir:     defer( function (cfg) { return cfg.auth.credentialsDir } ),
    tokenFile:        defer( function (cfg) { return `access_token_${cfg.instanceFullName}.json` } ),
  },

  companyName: 'OVERRIDE_ME',

  drive: {
    auth: {
      scopes: ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive.metadata.readonly"],
      clientSecretFile: defer( function (cfg) { return cfg.auth.clientSecretFile } ),
      tokenFile:        defer( function (cfg) { return `${cfg.auth.tokenFile}`.replace('.json', '-drive.json') } ),
      tokenFileDir:     defer( function (cfg) { return cfg.auth.credentialsDir } )
    },
    payslipsFolderName: 'Payslips'
  },

  log: {
    appName: defer(function (cfg) { return cfg.instanceFullName } ),
    level:   "INFO",
    log4jsConfigs: {
      appenders: [
        {
          type:       "file",
          filename:   defer(function (cfg) { return `${cfg.log.logDir}/${cfg.instanceFullName}.log` }),
          category:   defer(function (cfg) { return cfg.instanceFullName }),
          reloadSecs: 60,
          maxLogSize: 1024000
        },
        {
          type: "console"
        }
      ],
      replaceConsole: true
    },
    logDir: "./logs"
  },

  triggerChecker : {
    auth: {
      scopes: ['https://www.googleapis.com/auth/gmail.modify'],
      clientSecretFile: defer( function (cfg) { return cfg.auth.clientSecretFile } ),
      tokenFile:        defer( function (cfg) { return `${cfg.auth.tokenFile}`.replace('.json', `-triggerChecker.json`) } ),
      tokenFileDir:     defer( function (cfg) { return cfg.auth.credentialsDir } )
    },
    gmailSearchCriteria: 'OVERRIDE ME with a gmail search query string',
    processedLabelName: defer( function (cfg) { return `${cfg.instanceFullName}-Processed` } )
  },

  triggerEmail: {
    subject: "OVERRIDE_ME"
  },

  portus: {
    username: 'OVERRIDE_ME',
    password: 'OVERRIDE_ME'
  },

  ePayWindow: {
    username: 'OVERRIDE_ME',
    password: 'OVERRIDE_ME'
  },

  reporter : {
    emailsFrom: `OVERRIDE_ME`,
    user:      'OVERRIDE_ME',
    appSpecificPassword:  'OVERRIDE_ME',
    to:        'OVERRIDE_ME',
    subject:   defer( function (cfg) { return `Payslip Saver Report - ${cfg.instanceFullName}` } )
  }
}
