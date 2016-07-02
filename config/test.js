var cfg   = require('config');
var defer = require('config/defer').deferConfig;

module.exports = {

  test: {
    commonStubs: {
      'cfg': {
        debug: function() {},
        error: function() {},
        info:  function() {}
      },
      'log': {
        debug:    function() {},
        error:    function() {},
        info:     function() {},
        setLevel: function() {}
      },
      'log4js': {
        configure: function() {},
        getLogger: function() {}
      }
    },
    timeout: {
      unit: (1000*2)
    }
  }

} 
