var cfg   = require('config');
var defer = require('config/defer').deferConfig;

module.exports = {
  appName: process.env.npm_package_config_appName,

  auth: {
    credentialsDir:   process.env.HOME+"/.credentials",
    clientSecretFile: defer( function (cfg) { return cfg.auth.credentialsDir+"/client_secret.json" } ),
    tokenFileDir:     defer( function (cfg) { return cfg.auth.credentialsDir } ),
    tokenFile:        defer( function (cfg) { return "access_token_"+cfg.appName+".json" } ),
    scopes:           process.env.npm_package_config_googleAuthScopes.split(",")
  },

  log: {
    appName: defer(function (cfg) { return cfg.appName } ),
    level:   "INFO",
    log4jsConfigs: {
      appenders: [
        {
          type:       "file",
          filename:   defer(function (cfg) { return cfg.log.logDir.concat("/" , cfg.appName , ".log" ) }),
          category:   defer(function (cfg) { return cfg.appName }),
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

  // Common gmail parameters
  gmailParams : {
    name             : defer ( function (cfg) { return cfg.mailbox.name } ),
    userId           : defer ( function (cfg) { return cfg.mailbox.userId } ),
    user             : defer ( function (cfg) { return cfg.email.user } ),
    appSpecificPassword : defer ( function (cfg) { return cfg.email.password } ),
    googleScopes     : defer ( function (cfg) { return cfg.auth.scopes } ),
    tokenFile        : defer ( function (cfg) { return cfg.auth.tokenFile } ),
    tokenDir         : defer ( function (cfg) { return cfg.auth.tokenFileDir } ),
    clientSecretFile : defer ( function (cfg) { return cfg.auth.clientSecretFile } ),
  }
} 
