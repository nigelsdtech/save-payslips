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



/*
 * The actual tests
 */

describe('The trigger checker', function () {

  this.timeout(timeout);

  before(function () {
    // Stub out external modules
    tc.__set__(cfg.test.commonStubs);
    tc.__set__('en', {
      hasBeenReceived: stubFn,
      allHaveBeenProcessed: stubFn
    });
  })

  describe('isProcessingRequired', () => {


    describe('checking a message has been received', () => {

      it('returns an error if the EN api fails', async () => {
        tc.__set__('en', { flushCache: stubFn, hasBeenReceived: cbErr });
        try { await tc.isProcessingRequired(); throw new Error ('Should not have reached here') }
        catch (e) { e.message.should.include('Test Fail'); }
      });

      it('returns false if it hasn\'t ', async () => {
        tc.__set__('en', { flushCache: stubFn, hasBeenReceived: cbFalse});
        const ipr = await tc.isProcessingRequired();
        ipr.should.be.false
      });
    });


    describe('checking a message has been processed', function () {

      it('returns an error if the EN api fails', async () => {
        tc.__set__('en', { flushCache: stubFn, hasBeenReceived: cbTrue, allHaveBeenProcessed: cbErr });
        try { await tc.isProcessingRequired(); throw new Error ('Should not have reached here') }
        catch (e) { e.message.should.include('Test Fail'); }
      });

      it('returns true if it has', async () => {
        tc.__set__('en', { flushCache: stubFn, hasBeenReceived: cbTrue, allHaveBeenProcessed: cbFalse});
        const ipr = await tc.isProcessingRequired();
        ipr.should.be.true
      });

      it('returns false if it hasn\'t', async () => {
        tc.__set__('en', { flushCache: stubFn, hasBeenReceived: cbTrue, allHaveBeenProcessed: cbTrue });
        const ipr = await tc.isProcessingRequired();
        ipr.should.be.false
      });
    });
  });

});
