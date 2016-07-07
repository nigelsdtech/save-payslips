'use strict'

var cfg    = require('config'),
    chai   = require('chai'),
    rewire = require('rewire'),
    tc     = rewire('../../lib/triggerChecker.js');

/*
 * Set up chai
 */
chai.should();


var timeout = cfg.test.timeout.unit;

// Some common functions

var stubFn  = function ()     {},
    cbErr   = function (p,cb) { cb(new Error ('Test Fail'))},
    cbTrue  = function (p,cb) { cb(null,true) },
    cbFalse = function (p,cb) { cb(null,false) };

var testIsErr = function (e, done) {e.should.be.an.error; done();}



/*
 * The actual tests
 */

describe('The trigger checker', function () {

  this.timeout(timeout);

  var revert;

  before(function (done) {


    // Stub out external modules

    var stubs = cfg.test.commonStubs
    tc.__set__(stubs);
    tc.__set__('en', {
      hasBeenReceived: stubFn,
      hasBeenProcessed: stubFn
    });

    done();

  })

  describe('isProcessingRequired', function () {


    describe('checking a message has been received', function () {

      it('returns an error if the EN api fails', function (done) {
        tc.__set__('en', { hasBeenReceived: cbErr });
        tc.isProcessingRequired(null, function (e,cb) {testIsErr(e,done)})
      });

      it('returns false if it hasn\'t ', function (done) {
        tc.__set__('en', { hasBeenReceived: cbFalse});
        tc.isProcessingRequired(null, function (e,ret) { ret.should.be.false; done(); } )
      });
    });


    describe('checking a message has been processed', function () {

      it('returns an error if the EN api fails', function (done) {
        tc.__set__('en', { hasBeenReceived: cbTrue, hasBeenProcessed: cbErr });
        tc.isProcessingRequired(null, function (e,cb) {testIsErr(e,done)})
      });

      it('returns false if it has', function (done) {
        tc.__set__('en', { hasBeenReceived: cbTrue, hasBeenProcessed: cbFalse});
        tc.isProcessingRequired(null, function (e,ret) { ret.should.be.true; done(); } )
      });

      it('returns true if it hasn\'t', function (done) {
        tc.__set__('en', { hasBeenReceived: cbTrue, hasBeenProcessed: cbTrue });
        tc.isProcessingRequired(null, function (e,ret) { ret.should.be.false; done(); } )
      });
    });
  });

});
