'use strict'

var cfg      = require('config'),
    chai     = require('chai'),
    rewire   = require('rewire'),
    sinon    = require('sinon'),
    notifier = rewire('../../lib/notifier.js');

/*
 * Set up chai
 */
chai.should();


// Common testing timeout
var timeout = cfg.test.timeout.unit;

// Some common functions
var stubFn = function () {},
    cbErr  = function (p,cb) { cb(new Error ('Test Fail'))};



/*
 * The actual tests
 */

describe('The notifier', function () {

  this.timeout(timeout);

  before(function (done) {

    // Stub out external modules

    var stubs = cfg.test.commonStubs;
    stubs.GmailModel  = {
      constructor: stubFn,
      sendMessage: stubFn
    }
    stubs.cfg = {
      notificationEmail : {
        to: 'dud'
      }
    }
    notifier.__set__(stubs);

    done();

  });

  describe('HandleError', function () {

    it('returns an error if the mailer fails', function (done) {

      notifier.__set__('GmailModel', { sendMessage: cbErr } );
      sinon.spy(notifier, "handleError");;

      notifier.handleError("This is an email");

      notifier.mailer.sendMessage.called.should.be.true
      done();
    });

  });

});
