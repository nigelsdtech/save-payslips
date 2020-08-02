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

function testAfter   (stubHub) {
  afterEach (() => { for (const key in stubHub) {stubHub[key].reset()  }})
  after     (()=>  { for (const key in stubHub) { if(stubHub[key].wrappedMethod) stubHub[key].restore()} })
}

async function createErrorTest(stub,fn, fnArgs) {
  const err = new Error('Stub error')
  stub.rejects(err)
  try {
    const i = await fn(fnArgs)
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
    const stubHub = {};
  
    before(() => {
      stubHub.tcIprStub = sinon.stub(triggerChecker,'isProcessingRequired')
    })
    
    testAfter(stubHub)

    it('returns true if the trigger checker says so', async () => {
     stubHub.tcIprStub.resolves(true)
     const i = await fn()
     i.should.eql(true)
    })
      
    it('returns false if the trigger checker says so', async () => {
      stubHub.tcIprStub.resolves(false)
      const i = await fn()
      i.should.eql(false)
    })
    it('throws an error if the trigger checker goes wrong', async () => {
      await createErrorTest(stubHub.tcIprStub, fn)
    });

  });


  const payslipGetter = require(`../../lib/payslipGetter${cfg.payslipGetter}`)

  describe('syncLatestPayslip', () => {

    const fn = sp.__get__('syncLatestPayslip')
    const stubHub = {}

    before(() => {
      stubHub.pgDlpStub = sinon.stub(payslipGetter,'downloadPayslip')
      stubHub.upStub = sinon.stub()
    })

    testAfter(stubHub)

    it('calls the uploader with the new content', async () => {
     
      const f = '/tmp/myNewFile.pdf'
      const uploadedFileDetails = {fileUrl: 'file.com', folderUrl: 'folder.com'}
      
      stubHub.pgDlpStub.resolves(f)
      stubHub.upStub.withArgs(f).resolves(uploadedFileDetails)

      const i = await fn({uploadFn: stubHub.upStub})

      stubHub.upStub.calledWith(f).should.be.true     
      i.should.eql([uploadedFileDetails])
    })
      
    it('throws an error if the download goes wrong', async () => {
      await createErrorTest(stubHub.pgDlpStub, fn)
    });

    it('throws an error if the upload goes wrong', async () => {
      
      const f = '/tmp/myNewFile.pdf'
      stubHub.pgDlpStub.resolves(f)

      await createErrorTest(stubHub.upStub, fn, {uploadFn: stubHub.upStub})
      stubHub.upStub.calledWith(f).should.be.true
    });

  });


  describe('syncAllPayslips', () => {

    const fn    = sp.__get__('syncAllPayslips')
    const drive = require(`../../lib/driveUploader.js`)
    const stubHub = {}

    const filesInProvider = [
      {id:1, date:'2001-01-01'},
      {id:2, date:'2002-02-02'},
      {id:3, date:'2003-03-03'},
      {id:4, date:'2004-04-04'}
    ]

    before(() => {
      stubHub.drGkpStub = sinon.stub(drive,'getKnownPayslips')
      stubHub.pgGkpStub = sinon.stub(payslipGetter,'getKnownPayslips')
      stubHub.pgDlpStub = sinon.stub(payslipGetter,'downloadPayslip')
      stubHub.upStub    = sinon.stub()
    })

    testAfter(stubHub)

    it('calls the uploader with all files when the drive is empty', async () => {
      stubHub.drGkpStub.resolves([])
      stubHub.pgGkpStub.resolves(filesInProvider)

      const uploadedFileDetails = [
        {fileUrl: 'file1.com', folderUrl: 'folder1.com'},
        {fileUrl: 'file2.com', folderUrl: 'folder2.com'},
        {fileUrl: 'file3.com', folderUrl: 'folder3.com'},
        {fileUrl: 'file4.com', folderUrl: 'folder4.com'}
      ]

      filesInProvider.forEach((fip,i) => {
        
        const f = `/tmp/${fip.date}-${cfg.companyName}.pdf`
        stubHub.pgDlpStub
        .withArgs({id: fip.id, date: fip.date, suffix: cfg.companyName})
        .resolves(f)

        stubHub.upStub
        .withArgs(f)
        .resolves({fileUrl: `file${i+1}.com`, folderUrl: `folder${i+1}.com`})
      })
      
      const i = await fn({uploadFn: stubHub.upStub})

      filesInProvider.forEach((fip) => {
        const f = `/tmp/${fip.date}-${cfg.companyName}.pdf`
        stubHub.upStub.calledWith(f).should.be.true
      })

      i.should.eql(uploadedFileDetails)

    })

    it('calls the uploader with only new files when the drive is not empty', async () => {
      stubHub.drGkpStub.resolves([
        {date: '2001-01-01', companyName: 'FictionCorp'},
        {date: '2002-02-02', companyName: 'FictionCorp'},
        {date: '2003-03-03', companyName: 'OtherCo'}
      ])
      stubHub.pgGkpStub.resolves(filesInProvider)

      const uploadedFileDetails = [
        {fileUrl: 'file3.com', folderUrl: 'folder3.com'},
        {fileUrl: 'file4.com', folderUrl: 'folder4.com'}
      ]

      filesInProvider.forEach((fip,i) => {
        const f = `/tmp/${fip.date}-${cfg.companyName}.pdf`
        if(i >= 2 ) {
          stubHub.pgDlpStub.withArgs({id: fip.id, date: fip.date, suffix: cfg.companyName}).resolves(f)
          stubHub.upStub.withArgs(f).resolves({fileUrl: `file${i+1}.com`, folderUrl: `folder${i+1}.com`})
        } else {
          stubHub.pgDlpStub.withArgs({id: fip.id, suffix: cfg.companyName}).throws('You should not have gotten here')
          stubHub.upStub.withArgs(f).throws('You should not have gotten here')
        }
      })
      
      const i = await fn({uploadFn: stubHub.upStub})

      filesInProvider.forEach((fip,i) => {
        const f = `/tmp/${fip.date}-${cfg.companyName}.pdf`
        if(i >= 2 ) {
          stubHub.upStub.calledWith(f).should.be.true
        } else {
          stubHub.upStub.calledWith(f).should.be.false
        }
      })

      i.should.eql(uploadedFileDetails)
    })


    it('does not call the uploader when the two are in sync', async () => {
      stubHub.drGkpStub.resolves([
        {date: '2001-01-01', companyName: 'FictionCorp'},
        {date: '2002-02-02', companyName: 'FictionCorp'},
        {date: '2003-03-03', companyName: 'FictionCorp'},
        {date: '2004-04-04', companyName: 'FictionCorp'}
      ])
      stubHub.pgGkpStub.resolves(filesInProvider)

      const uploadedFileDetails = []

      filesInProvider.forEach((fip,i) => {
        const f = `/tmp/${fip.date}-${cfg.companyName}.pdf`

        stubHub.pgDlpStub.withArgs({id: fip.id, date: fip.date, suffix: cfg.companyName}).throws('You should not have gotten here')
        stubHub.upStub.withArgs(f).throws('You should not have gotten here')
      })
      
      const i = await fn({uploadFn: stubHub.upStub})

      filesInProvider.forEach((fip,i) => {
        const f = `/tmp/${fip.date}-${cfg.companyName}.pdf`
        stubHub.upStub.calledWith(f).should.be.false
      })

      i.should.eql(uploadedFileDetails)
    })

      
    it('throws an error if the drive goes wrong', async () => {
      await createErrorTest(stubHub.drGkpStub, fn)
    })

    it('throws an error if the provider goes wrong', async () => {
      await createErrorTest(stubHub.pgGkpStub, fn)
    })

    it('throws an error if the uploader goes wrong', async () => {
      stubHub.drGkpStub.resolves([
        {date: '2001-01-01', companyName: 'FictionCorp'},
        {date: '2002-02-02', companyName: 'FictionCorp'},
        {date: '2003-03-03', companyName: 'FictionCorp'}
      ])
      stubHub.pgGkpStub.resolves(filesInProvider)

      const uploadedFileDetails = [
        {fileUrl: 'file4.com', folderUrl: 'folder4.com'}
      ]

      const [fid, fdate, cn] = [4, '2004-04-04', cfg.companyName]
      const f = `/tmp/${fdate}-${cn}.pdf`
      stubHub.pgDlpStub.withArgs({id: fid, date: fdate, suffix: cn}).resolves(f)

      await createErrorTest(stubHub.upStub, fn, {uploadFn: stubHub.upStub})
      stubHub.upStub.calledWith(f).should.be.true
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
      uploadDetails = [{fileUrl: 'file1.com', folderUrl: 'folder1.com'}, {fileUrl: 'file2.com', folderUrl: 'folder2.com'}],
      updateEmailLabels = false,
      sendCompletionNotice = true,
      sendErrorNotice = false
    } = {}) {

      const desc = (only)? describe.only: describe; 
      desc(description, () => {

        const rewireStubs = []
        const stubHub = {}

        before(async () => {

          stubHub.iprStub   = sinon.stub().resolves(isProcessingRequired)
          stubHub.sapStub   = sinon.stub().resolves(uploadDetails)
          stubHub.slpStub   = sinon.stub().resolves(uploadDetails)
          
          stubHub.ulStub    = sinon.stub(tc, 'updateLabels').resolves('')
          
          
          stubHub.scnStub   = sinon.stub(rp, 'sendCompletionNotice')

          if (sendCompletionNotice) {
            stubHub.scnStub.withArgs(uploadDetails).returns()
          } else {
            stubHub.scnStub.throws('You should not have gotten here')
          }

          stubHub.heStub = sinon.stub(rp, 'handleError')
          if (sendErrorNotice) {
            stubHub.heStub.returns()
          } else {
            stubHub.heStub.throws('You should not have gotten here')
          }
          

          rewireStubs.push(
            sp.__set__('isProcessingRequired',  stubHub.iprStub),
            sp.__set__('syncAllPayslips',       stubHub.sapStub),
            sp.__set__('syncLatestPayslip',     stubHub.slpStub)
          )

          await fn({
            useEmailTrigger: checkForProcessing,
            downloadMode: downloadMode
          })
        })
 
        after(() => {
          for (const key in stubHub) {
            stubHub[key].reset();
            if (stubHub[key].restore) stubHub[key].restore();
          }
          rewireStubs.forEach( revert => {revert()} )
          rewireStubs.splice(0,rewireStubs.length-1)
        })

        if (checkForProcessing) {
          it('Checks for processing', () => {stubHub.iprStub.calledOnce.should.be.true})
        } else {
          it('Does not check for processing', () => {stubHub.iprStub.called.should.be.false})
        }

        switch(downloadMode) {
          case 'sync': {
            it('Downloads the payslips', () => {
              stubHub.sapStub.calledOnce.should.be.true
              stubHub.slpStub.called.should.be.false
            })
            break;
          }
          case 'downloadLatest': {
            it('Downloads the payslips', () => {
              stubHub.slpStub.calledOnce.should.be.true
              stubHub.sapStub.called.should.be.false
            })
            break;
          }
          default : {
            it('Does not attempt a download', () => {
              stubHub.sapStub.called.should.be.false
              stubHub.slpStub.called.should.be.false
            })
          }
        }

        if (updateEmailLabels) {
          it('Updates the label on the email', () => {stubHub.ulStub.called.should.be.true})
        } else {
          it('Does not update the label on the email', () => {stubHub.ulStub.called.should.be.false})
        }

        if (sendCompletionNotice) {
          it('Sends a completion notice', () => {stubHub.scnStub.calledWith({uploadedFileDetails: uploadDetails}).should.be.true})
        } else {
          it('Does not send a completion notice', () => {stubHub.scnStub.called.should.be.false})
        }

        if (sendErrorNotice) {
          it('Sends an error notice', () => {stubHub.heStub.called.should.be.true})
        } else {
          it('Does not send an error notice', () => {stubHub.heStub.called.should.be.false})
        }
      })  
    }
  
    generateTestSuite ({
      description: "Email trigger in use but processing isn't required",
      checkForProcessing: true,
      isProcessingRequired: false,
      downloadMode: 'none',
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
      updateEmailLabels: false,
      sendCompletionNotice: false,
      sendErrorNotice: true,
      errorMessage: 'somethingBad'
    })
  });

  describe('uploadPayslipToGdrive', () => {

    const fn = sp.__get__('uploadPayslipToGdrive')
    const drive     = require(`../../lib/driveUploader.js`)
    const stubHub = {}

    before(() => {
      stubHub.drUpStub = sinon.stub(drive,'uploadPayslip')
    })

    testAfter(stubHub)

    it('returns the url of the uploaded file', async () => {
      stubHub.drUpStub.resolves({fileUrl: 'www.fileUrl.com', folderUrl: 'www.parentUrl.com'})
      const i = await fn()
      i.should.eql({fileUrl: 'www.fileUrl.com', folderUrl: 'www.parentUrl.com'})
    })
      
    it('throws an error if the upload goes wrong', async () => {
      await createErrorTest(stubHub.drUpStub, fn)
    });

  });
});