'use strict'

var cfg    = require('config'),
    chai   = require('chai'),
    rewire = require('rewire'),
    psg    = rewire('../../lib/payslipGetterPortus.js');

/*
 * Set up chai
 */
chai.should();


var timeout = cfg.test.timeout.unit;

// Some common functions

var stubFn  = function ()     {},
    cbErr   = function (p,cb) { cb(new Error ('Test Fail'))};

var testIsNotErr = function (e, cb) {e.should.not.be.an('error'); cb();}



/*
 * The actual tests
 */

describe('The Portus interactor', function () {

  this.timeout(timeout);

  before(function (done) {

    // Stub out external modules

    var stubs = cfg.test.commonStubs
    psg.__set__(stubs);
    psg.__set__('PortusInteract', stubFn);
    psg.__set__('portus', stubFn);

    done();

  });

  describe('downloading a payslip', function () {

    it('gracefully catches errors', function (done) {
      psg.__set__('portus', { downloadLatestPayslip: cbErr });
      psg.downloadPayslip(null, function (e,cb) {testIsNotErr(e,done)})
    });

    it('Returns the file location if it has', function (done) {
      psg.__set__('portus', { downloadLatestPayslip: function(p,cb) { cb(null, 'File location')} });
      psg.downloadPayslip(null, function (e,ret) { ret.should.be.a.string; done(); } )
    });

  });


  after(function (done) {

    // Stub out rewire and its globals
    psg = null
    rewire = null

    done();

  });

});
