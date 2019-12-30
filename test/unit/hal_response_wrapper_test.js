const HalResponseWrapper = require('../../lib/hal_response_wrapper').HalResponseWrapper;
const _ = require('lodash');

describe('HalResponseWrapper', function() {
  beforeEach(function() {
    this.axiosMock = sinon.mock(HorizonAxiosClient);
    StellarSdk.Config.setDefault();
  });

  afterEach(function() {
    this.axiosMock.verify();
    this.axiosMock.restore();
  });

  it('sets data', function() {
    let randomResult = {
      data: {
        url: "http://some.where/",
        random: Math.round(1000 * Math.random()),
        endpoint: 'bogus'
      }
    };
    
    const result = new HalResponseWrapper(randomResult.data).out();
    expect(result).to.deep.equal(randomResult.data);
  });
  
  
  it('create links function', function(done) {
    let randomResult = {
      data: {
        _links: {
          go: {
            href: "http://some.where/"
          }
        },
        random: Math.round(1000 * Math.random()),
        endpoint: 'bogus'
      }
    };
    
    let someWhereResult = {
      data: {
        result: 'went'
      }
    }
  
    const result = new HalResponseWrapper(randomResult.data).out();
    expect(result).to.include(randomResult.data);
    expect(result).respondTo('go');
    
    this.axiosMock
      .expects('get')
      .withArgs(sinon.match('http://some.where/'))
      .returns(Promise.resolve(someWhereResult));
    
    result
      .go()
      .should.eventually.deep.equal(someWhereResult.data)
      .notify(done);
  });
  
  it('re-hydrate a previously serialized result', function(done) {
    let randomResult = {
      data: {
        _links: {
          go: {
            href: "http://some.where/"
          }
        },
        random: Math.round(1000 * Math.random()),
        endpoint: 'bogus'
      }
    };
    
    let someWhereResult = {
      data: {
        result: 'went'
      }
    }
    
    const result = new HalResponseWrapper(randomResult.data).out();
    const serialized = JSON.stringify(result);
    const result2 = new HalResponseWrapper(JSON.parse(serialized)).out();
    
    expect(result2).to.deep.equal(randomResult.data);
    expect(result2).respondTo('go');
    
    this.axiosMock
      .expects('get')
      .withArgs(sinon.match('http://some.where/'))
      .returns(Promise.resolve(someWhereResult));
      
    result2
      .go()
      .should.eventually.deep.include(someWhereResult.data)
      .notify(done);
  })
  
});
