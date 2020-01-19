'use strict'

var cfg    = require('config'),
    chai   = require('chai'),
    sinon  = require('sinon'),
    rewire = require('rewire'),
    drive  = rewire('../../lib/driveUploader.js');

/*
 * Set up chai
 */
chai.should();


// Common testing timeout
var timeout = cfg.test.timeout.unit;


/*
 * The actual tests
 */

describe('The drive uploader', function () {

  this.timeout(timeout);

  describe('getPayslipFolderInfo', () => {

    const getPayslipFolderInfo = drive.__get__('getPayslipFolderInfo')
    const listFilesOld = drive.__get__('listFiles');
    const listFilesStub = sinon.stub()
    const basicGoodlfsResp = {
      id: 123,
      name: 'thisIsAParentFolder',
      webViewLink: 'thisIsThePayslipFolderUrl'
    }
    const basicGoodgpfiResp = {
      id: 123,
      url: 'thisIsThePayslipFolderUrl'
    }

    before(() => {
      drive.__set__('listFiles', listFilesStub);
      drive.__set__('cachedFolderInfo', {});
    })
    afterEach(() => {
      listFilesStub.reset()
      drive.__set__('cachedFolderInfo', {});
    })
    after(() => {
      listFilesStub.restore()
      drive.__set__('listFiles', listFilesOld);
    })

    it('returns the expected fields', async () => {

      listFilesStub.resolves([basicGoodlfsResp])
      
      const psfi = await getPayslipFolderInfo({folderName: cfg.drive.payslipsFolderName})

      psfi.should.eql(basicGoodgpfiResp)
    })

    it('uses a cached resource if called twice', async () => {
      listFilesStub.resolves([basicGoodlfsResp])

      const psfi = await getPayslipFolderInfo({folderName: cfg.drive.payslipsFolderName})
      psfi.should.eql(basicGoodgpfiResp)
      listFilesStub.calledOnce.should.be.true

      const psfi2 = await getPayslipFolderInfo({folderName: cfg.drive.payslipsFolderName})
      psfi2.should.eql(basicGoodgpfiResp)
      listFilesStub.calledOnce.should.be.true
    })

    it('throws an error if more than one folder is found', async () => {

      listFilesStub.resolves([
        basicGoodlfsResp,{
        id: 456,
        name: 'thisIsAnotherParentFolder',
        webViewLink: 'abc456'
      }])
      
      try {await getPayslipFolderInfo({folderName: cfg.drive.payslipsFolderName})}
      catch (e) {
        e.message.should.equal('drive: did not receive exactly one parent folder')
      }
      
    })

    it('throws an error if listFiles cannot be contacted', async () => {

      listFilesStub.rejects()

      try {await getPayslipFolderInfo({folderName: cfg.drive.payslipsFolderName})}
      catch (e) {
        e.message.should.equal('Error')
      }
      
    })
  })

  describe('UploadPayslip', function () {

    const uploadPayslip = drive.uploadPayslip
    const createFileOld = drive.__get__('createFile');
    const getPayslipFolderInfoOld = drive.__get__('getPayslipFolderInfo')

    before(() => {
      drive.__set__('getPayslipFolderInfo', sinon.stub().resolves({id: 1000, url: 'parentFolderUrl'}))
    })
    afterEach(() => {
      drive.__set__('createFile', createFileOld);
    })
    after(() => {
      drive.__set__('getPayslipFolderInfo', getPayslipFolderInfoOld)
    })

    it('returns the expected fields', async () => {

      const createFileStub = sinon.stub().resolves({webViewLink: 'newFileUrl123'})
      
      drive.__set__('createFile', createFileStub);
      const {fileUrl, folderUrl} = await uploadPayslip({localFileLocation: 'fileIsHere'})

      fileUrl.should.equal('newFileUrl123')
      folderUrl.should.equal('parentFolderUrl')
    })

    it('throws an error if the file cannot be created', async () => {

      const createFileStub = sinon.stub().rejects()
      
      drive.__set__('createFile', createFileStub);
      try {await uploadPayslip({localFileLocation: 'fileIsHere'})}
      catch (e) {
        e.message.should.eql('Error')
      }

    })

  })

  describe('getKnownPayslips', () => {

    const getKnownPayslips = drive.getKnownPayslips
    const listFilesOld = drive.__get__('listFiles');
    const listFilesStub = sinon.stub()
    const getPayslipFolderInfoOld = drive.__get__('getPayslipFolderInfo')
    const basicGoodlfsResp = [
      {name: '2001-01-01-PS1.pdf'},
      {name: '2002-02-02-PS2.pdf'},
      {name: '2003-03-03-PS3.pdf'}
    ]
    const basicGoodgkpResp = [
      {date: '2001-01-01', companyName: 'PS1'},
      {date: '2002-02-02', companyName: 'PS2'},
      {date: '2003-03-03', companyName: 'PS3'}
    ]

    before(() => {
      drive.__set__('getPayslipFolderInfo', sinon.stub().resolves({id: 1000, url: 'parentFolderUrl'}))
      drive.__set__('listFiles', listFilesStub);
    })
    afterEach(() => {
      listFilesStub.reset()
    })
    after(() => {
      listFilesStub.restore()
      drive.__set__('listFiles', listFilesOld);
      drive.__set__('getPayslipFolderInfo', getPayslipFolderInfoOld)
    })

    it('returns the expected fields', async () => {

      listFilesStub.resolves(basicGoodlfsResp)
      
      const gkp = await getKnownPayslips()

      gkp.should.eql(basicGoodgkpResp)
    })


    it('throws an error if listFiles cannot be contacted', async () => {

      listFilesStub.rejects()

      try {await getKnownPayslips()}
      catch (e) {
        e.message.should.equal('Error')
      }
      
    })
  })
});


