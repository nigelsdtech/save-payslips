'use strict'

var cfg    = require('config'),
    chai   = require('chai'),
    rewire = require('rewire'),
    drive  = rewire('../../lib/driveUploader.js');

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

describe('The drive uploader', function () {

  this.timeout(timeout);


  before(function (done) {

    // Stub out external modules

    var stubs = cfg.test.commonStubs
    stubs.g           = stubFn
    stubs.GdriveModel = stubFn
    stubs.path        = { basename: function () {return 'stub'} }
    drive.__set__(stubs);

    done();

  });

  describe('UploadPayslip', function () {

    var cbListFilesGood = function (p,cb) { cb(null,[{id: 1, alternateLink: 'urlParent'}])};

    var p = {
      localFileLocation: '/tmp/file.txt'
    }

    describe('getting the Id of the "Payslips" folder', function () {

      it('returns an error if the google API fails', function (done) {
        drive.__set__('g', {listFiles: cbErr});
	drive.uploadPayslip(p, function (e,cb) {
	  e.should.be.an.error
	  done();
	})
      });
      
      it('returns an error if not exactly one found', function (done) {
        drive.__set__('g', { listFiles: function (p,cb) { cb(null,[1,2,3,4])}});
	drive.uploadPayslip(p, function (e,cb) {
	  e.should.be.an.error
	  e.message.should.equal('drive: did not receive exactly one parent folder')
	  done();
	});
      });
    });


    describe('uploading the payslip', function () {

      it('returns an error if the google API fails', function (done) {
        drive.__set__('g', {
          createFile: cbErr,
	  listFiles: cbListFilesGood
	});
	drive.uploadPayslip(p, function (e,cb) {
	  e.should.be.an.error;
	  e.message.should.equal('Test Fail');
	  done();
	})
      });

      it('creates a file under the parent folder', function (done) {
        drive.__set__('g', {
	  createFile: function (p,cb) { cb(null,{id: 2, alternateLink: 'urlPayslip'}) },
	  listFiles: cbListFilesGood
	});
	drive.uploadPayslip(p, function (e, altLink, parentUrl) {
	  altLink.should.equal('urlPayslip');
	  parentUrl.should.equal('urlParent');
	  done();
	});
      });
    });

  });
});
