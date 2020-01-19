'use strict'

var cfg      = require('config'),
    chai     = require('chai'),
    rewire   = require('rewire'),
    sinon    = require('sinon'),
    sp       = rewire('../../lib/SavePayslips.js')

/*
 * Set up chai
 */
chai.should();


var timeout = cfg.test.timeout.unit;


function testAfter (stubs) {
  afterEach(() => {stubs.forEach( (stub) => {stub.reset()  } )})
  after(() =>     {stubs.forEach( (stub) => {stub.restore()} )})
}

async function createErrorTest(stub,fn) {
  const err = new Error('Stub error')
  stub.rejects(err)
  try {
    const i = await fn()
  } catch (e) {
    e.message.should.eql(err.message)
  }
}


describe('SavePayslips', function () {

  this.timeout(timeout);

  before(() => {
    sp.__set__(cfg.test.commonStubs)
  })

  describe('isProcessingRequired', () => {

    const fn = sp.__get__('isProcessingRequired')
    const triggerChecker = require('../../lib/triggerChecker')
    const tcIprStub = sinon.stub(triggerChecker,'isProcessingRequired')

    testAfter([tcIprStub])

    it('returns true if the trigger checker says so', async () => {
     tcIprStub.resolves(true)
     const i = await fn()
     i.should.eql(true)
    })
      
    it('returns false if the trigger checker says so', async () => {
      tcIprStub.resolves(false)
      const i = await fn()
      i.should.eql(false)
    })
    it('throws an error if the trigger checker goes wrong', async () => {
      await createErrorTest(tcIprStub, fn)
    });

  });


  const payslipGetter = require(`../../lib/payslipGetter${cfg.payslipGetter}`)
  const pgDlpStub = sinon.stub(payslipGetter,'downloadPayslip')
  

  describe('downloadLatestPayslip', () => {

    const fn = sp.__get__('downloadLatestPayslip')

    testAfter([pgDlpStub])

    it('returns the location of the downloaded file', async () => {
     pgDlpStub.resolves('/tmp/myNewFile.pdf')
     const i = await fn()
     i.should.eql(['/tmp/myNewFile.pdf'])
    })
      
    it('throws an error if the download goes wrong', async () => {
      await createErrorTest(pgDlpStub, fn)
    });

  });


  describe('downloadSyncedPayslips', () => {

    const fn = sp.__get__('downloadSyncedPayslips')
    const drive     = require(`../../lib/driveUploader.js`)
    const drGkpStub = sinon.stub(drive,'getKnownPayslips')
    const pgGkpStub = sinon.stub(payslipGetter,'getKnownPayslips')

    const filesInProvider = [
      {id:1, date:'2001-01-01'},
      {id:2, date:'2002-02-02'},
      {id:3, date:'2003-03-03'},
      {id:4, date:'2004-04-04'}
    ]

    beforeEach(() => {
      filesInProvider
      .forEach(({id,date} = {}) => {
        pgDlpStub
        .withArgs({id: id, date: date, suffix: cfg.companyName})
        .resolves(`/tmp/${date}-${cfg.companyName}.pdf`)
      })

    })

    testAfter([pgDlpStub, drGkpStub, pgGkpStub])


    it('downloads all files when the drive is empty', async () => {
      drGkpStub.resolves([])
      pgGkpStub.resolves(filesInProvider)
      const i = await fn()
      i.should.eql([
        `/tmp/2001-01-01-${cfg.companyName}.pdf`,
        `/tmp/2002-02-02-${cfg.companyName}.pdf`,
        `/tmp/2003-03-03-${cfg.companyName}.pdf`,
        `/tmp/2004-04-04-${cfg.companyName}.pdf`
      ])
    })

    it('downloads only new files when the drive is not empty', async () => {
      drGkpStub.resolves([
        {date: '2001-01-01', companyName: 'FictionCorp'},
        {date: '2002-02-02', companyName: 'FictionCorp'},
        {date: '2003-03-03', companyName: 'OtherCo'}
      ])
      pgGkpStub.resolves(filesInProvider)
      const i = await fn()
      i.should.eql([
        `/tmp/2003-03-03-${cfg.companyName}.pdf`,
        `/tmp/2004-04-04-${cfg.companyName}.pdf`
      ])
    })


    it('does not download when the two are in sync', async () => {
      drGkpStub.resolves([
        {date: '2001-01-01', companyName: 'FictionCorp'},
        {date: '2002-02-02', companyName: 'FictionCorp'},
        {date: '2003-03-03', companyName: 'FictionCorp'},
        {date: '2004-04-04', companyName: 'FictionCorp'}
      ])
      pgGkpStub.resolves(filesInProvider)
      const i = await fn()
      i.should.eql([])
      pgDlpStub.called.should.be.false
    })

      
    it('throws an error if the drive goes wrong', async () => {
      await createErrorTest(drGkpStub, fn)
    })

    it('throws an error if the provider goes wrong', async () => {
      await createErrorTest(pgGkpStub, fn)
    })


  });

  describe('main', () => {

    const fn = sp.__get__('main')
    const tc = require('../../lib/triggerChecker')
    const rp = require('../../lib/reporter')

    function generateTestSuite ({
      description,
      only = false,
      checkForProcessing = false,
      isProcessingRequired = false,
      downloadMode = 'sync',
      downloadedFileLocations = ['file1', 'file2'],
      uploadToGdrive = true,
      gdriveCalls = 2,
      uploadDetails = [{fileUrl: 'file1.com', folderUrl: 'folder1.com'}, {fileUrl: 'file2.com', folderUrl: 'folder2.com'}],
      updateEmailLabels = false,
      sendCompletionNotice = true,
      sendErrorNotice = false
    } = {}) {

      const desc = (only)? describe.only: describe; 
      desc(description, () => {

        const stubActivations = []
        const stubs = {}

        before(async () => {

          stubs.iprStub = sinon.stub().resolves(isProcessingRequired)
          stubs.dspStub = sinon.stub().resolves(downloadedFileLocations)
          stubs.dlpStub = sinon.stub().resolves(downloadedFileLocations)
          stubs.uptdgStub = sinon.stub()
          
          downloadedFileLocations.forEach((fileLocation, i) => {
            stubs.uptdgStub
            .withArgs(fileLocation)
            .resolves(uploadDetails[i])
          })
          
          stubs.ulStub = sinon.stub(tc, 'updateLabels').resolves('')
          stubs.scnStub = sinon.stub(rp, 'sendCompletionNotice')
          if (sendCompletionNotice) {stubs.scnStub.withArgs(uploadDetails).returns()}
          stubs.scnStub.returns()
          stubs.heStub = sinon.stub(rp, 'handleError').returns()

          stubActivations.push(
            sp.__set__('isProcessingRequired',   stubs.iprStub),
            sp.__set__('downloadSyncedPayslips', stubs.dspStub),
            sp.__set__('downloadLatestPayslip',  stubs.dlpStub),
            sp.__set__('uploadPayslipToGdrive',  stubs.uptdgStub)
          )

          await fn({
            useEmailTrigger: checkForProcessing,
            downloadMode: downloadMode
          })
        })
 
        after(() => {
          for (const stub in stubs) {
            stubs[stub].reset();
          }
          stubs.ulStub.restore()
          stubs.scnStub.restore()
          stubs.heStub.restore()

          stubActivations.forEach( (revert) => {revert()} )
          stubActivations.splice(0,stubActivations.length-1)
        })

        if (checkForProcessing) {
          it('Checks for processing', () => {stubs.iprStub.calledOnce.should.be.true})
        } else {
          it('Does not check for processing', () => {stubs.iprStub.called.should.be.false})
        }

        switch(downloadMode) {
          case 'sync': {
            it('Downloads the payslips', () => {
              stubs.dspStub.calledOnce.should.be.true
              stubs.dlpStub.called.should.be.false
            })
            break;
          }
          case 'downloadLatest': {
            it('Downloads the payslips', () => {
              stubs.dlpStub.calledOnce.should.be.true
              stubs.dspStub.called.should.be.false
            })
            break;
          }
          default : {
            it('Does not attempt a download', () => {
              stubs.dspStub.called.should.be.false
              stubs.dlpStub.called.should.be.false
            })
          }
        }

        if (uploadToGdrive) {
          it('Uploads the files to google drive', () => {
            downloadedFileLocations.forEach((fileLocation, i) => {
              stubs.uptdgStub
              .calledWith(fileLocation)
              .should.be.true
            })
            stubs.uptdgStub.callCount.should.eql(gdriveCalls)
          })
        } else {
          it('Does not upload to google drive', () => {stubs.uptdgStub.called.should.be.false})
        }

        if (updateEmailLabels) {
          it('Updates the label on the email', () => {stubs.ulStub.called.should.be.true})
        } else {
          it('Does not update the label on the email', () => {stubs.ulStub.called.should.be.false})
        }

        if (sendCompletionNotice) {
          it('Sends a completion notice', () => {stubs.scnStub.calledWith({uploadedFileDetails: uploadDetails}).should.be.true})
        } else {
          it('Does not send a completion notice', () => {stubs.scnStub.called.should.be.false})
        }

        if (sendErrorNotice) {
          it('Sends an error notice', () => {stubs.heStub.called.should.be.true})
        } else {
          it('Does not send an error notice', () => {stubs.heStub.called.should.be.false})
        }
      })  
    }
  
    generateTestSuite ({
      description: "Email trigger in use but processing isn't required",
      checkForProcessing: true,
      isProcessingRequired: false,
      downloadMode: 'none',
      uploadToGdrive: false,
      updateEmailLabels: false,
      sendCompletionNotice: false
    });

    generateTestSuite ({
      description: "Email trigger is in use and processing is required",
      checkForProcessing: true,
      isProcessingRequired: true,
      updateEmailLabels: true
    });

    generateTestSuite ({
      description: "Email trigger is not in use and using sync mode"
    })

    generateTestSuite ({
      description: "Email trigger is not in use and using sync mode and there are no differences",
      downloadedFileLocations: [],
      gdriveCalls: 0,
      uploadToGdrive: false,
      uploadDetails: [],
      updateEmailLabels: false,
      sendCompletionNotice: false
    })

    generateTestSuite ({
      description: "Email trigger is not in use and using download mode",
      downloadMode: 'downloadLatest'
    })

    generateTestSuite ({
      description: "Using a bad download mode",
      downloadMode: 'somethingBad',
      uploadToGdrive: false,
      gdriveCalls: 0,
      updateEmailLabels: false,
      sendCompletionNotice: false,
      sendErrorNotice: true,
      errorMessage: 'somethingBad'
    })
  });

  describe('uploadPayslipToGdrive', () => {

    const fn = sp.__get__('uploadPayslipToGdrive')
    const drive     = require(`../../lib/driveUploader.js`)
    const drUpStub = sinon.stub(drive,'uploadPayslip')

    testAfter([drUpStub])

    it('returns the url of the uploaded file', async () => {
      drUpStub.resolves({fileUrl: 'www.fileUrl.com', folderUrl: 'www.parentUrl.com'})
      const i = await fn()
      i.should.eql({fileUrl: 'www.fileUrl.com', folderUrl: 'www.parentUrl.com'})
    })
      
    it('throws an error if the upload goes wrong', async () => {
      await createErrorTest(drUpStub, fn)
    });

  });
});