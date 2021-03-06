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

    const basicGoodlfsResp = {
      id: 123,
      name: 'thisIsAParentFolder',
      webViewLink: 'thisIsThePayslipFolderUrl'
    }
    const basicGoodgpfiResp = {
      id: 123,
      url: 'thisIsThePayslipFolderUrl'
    }

    const stubHub = {}
    const rewires = []

    beforeEach(() => {
      stubHub.listFilesStub = sinon.stub()
      rewires.push(
        drive.__set__('listFiles', stubHub.listFilesStub),
        drive.__set__('cachedFolderInfo', {})
      )
    })
    afterEach(() => {
      stubHub.listFilesStub.reset()
      rewires.forEach( revert => {revert()} )
      rewires.splice(0,rewires.length-1)
    })

    it('returns the expected fields', async () => {

      stubHub.listFilesStub.resolves([basicGoodlfsResp])
      
      const psfi = await getPayslipFolderInfo({folderName: cfg.drive.payslipsFolderName})

      psfi.should.eql(basicGoodgpfiResp)
    })

    it('uses a cached resource if called twice', async () => {
      stubHub.listFilesStub.resolves([basicGoodlfsResp])

      const psfi = await getPayslipFolderInfo({folderName: cfg.drive.payslipsFolderName})
      psfi.should.eql(basicGoodgpfiResp)
      stubHub.listFilesStub.calledOnce.should.be.true

      const psfi2 = await getPayslipFolderInfo({folderName: cfg.drive.payslipsFolderName})
      psfi2.should.eql(basicGoodgpfiResp)
      stubHub.listFilesStub.calledOnce.should.be.true
    })

    it('throws an error if more than one folder is found', async () => {

      stubHub.listFilesStub.resolves([
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

      stubHub.listFilesStub.rejects()

      try {await getPayslipFolderInfo({folderName: cfg.drive.payslipsFolderName})}
      catch (e) {
        e.message.should.equal('Error')
      }
      
    })
  })

  describe('UploadPayslip', function () {

    const uploadPayslip = drive.uploadPayslip

    const stubHub = {}
    const rewiresTemp = []
    const rewiresPerm = []

    before(() => {
      stubHub.createFileStub = sinon.stub()
      rewiresPerm.push(
        drive.__set__('getPayslipFolderInfo', sinon.stub().resolves({id: 1000, url: 'parentFolderUrl'}))
      )
    })
    beforeEach(() => {
      rewiresTemp.push(
        drive.__set__('cachedFolderInfo', {}),
        drive.__set__('createFile', stubHub.createFileStub)
      )
    })
    afterEach(() => {
      for (const s in stubHub) {stubHub[s].reset()}

      rewiresTemp.forEach( revert => {revert()} )
      rewiresTemp.splice(0,rewiresTemp.length-1)
    })
    after(() => {
      rewiresPerm.forEach( revert => {revert()} )
      rewiresPerm.splice(0,rewiresPerm.length-1)
    })
  

    it('returns the expected fields', async () => {

      stubHub.createFileStub.resolves({webViewLink: 'newFileUrl123'})
      
      const {fileUrl, folderUrl} = await uploadPayslip({localFileLocation: 'fileIsHere'})

      fileUrl.should.equal('newFileUrl123')
      folderUrl.should.equal('parentFolderUrl')

    })

    it('throws an error if the file cannot be created', async () => {

      stubHub.createFileStub.rejects()
      
      try {await uploadPayslip({localFileLocation: 'fileIsHere'})}
      catch (e) {
        e.message.should.eql('Error')
      }

    })

  })

  describe('getKnownPayslips', () => {

    const getKnownPayslips = drive.getKnownPayslips

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

    const stubHub = {}
    const rewiresTemp = []
    const rewiresPerm = []

    before(() => {
      stubHub.listFilesStub = sinon.stub()
      rewiresPerm.push(
        drive.__set__('getPayslipFolderInfo', sinon.stub().resolves({id: 1000, url: 'parentFolderUrl'})),
        drive.__set__('listFiles', stubHub.listFilesStub)
      )     
    })
    beforeEach(() => {
      rewiresTemp.push(
        drive.__set__('cachedFolderInfo', {}),
        drive.__set__('createFile', stubHub.createFileStub)
      )
    })
    afterEach(() => {
      for (const s in stubHub) {stubHub[s].reset()}
      rewiresTemp.forEach( revert => {revert()} )
      rewiresTemp.splice(0,rewiresTemp.length-1)
    })
    after(() => {
      for (const s in stubHub) {if(stubHub[s].wrappedMethod) stubHub[s].restore()}
      rewiresPerm.forEach( revert => {revert()} )
      rewiresPerm.splice(0,rewiresPerm.length-1)
    })


    it('returns the expected fields', async () => {
      stubHub.listFilesStub.resolves(basicGoodlfsResp)
      const gkp = await getKnownPayslips()
      gkp.should.eql(basicGoodgkpResp)
    })


    it('throws an error if listFiles cannot be contacted', async () => {
      stubHub.listFilesStub.rejects()
      try {await getKnownPayslips()}
      catch (e) {
        e.message.should.equal('Error')
      }
    })
  })
});


