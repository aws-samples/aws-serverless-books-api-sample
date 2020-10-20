// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';

chai.use(sinonChai);
const expect = chai.expect;

import * as AWSMock from 'aws-sdk-mock';
import * as AWS from 'aws-sdk';

import {handler} from '../index';

interface Book {
  isbn: string;
  title: string;
  year: number;
  author: string;
  publisher: string;
  rating: number;
  pages: number;
};

describe('create book tests', () => {
  let sandbox: sinon.SinonSandbox;
  let dynamoDbStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    AWSMock.setSDKInstance(AWS);    
  });

  afterEach(() => {
    AWSMock.restore('DynamoDB');
    sandbox.restore();
  });

  it('should put a book into DynamoDB', async () => {
    // arrange
    dynamoDbStub = sandbox.stub().callsFake((params, cb) => cb(null));
    AWSMock.mock('DynamoDB', 'putItem', dynamoDbStub);
    
    const book = buildBook();
    const event = {body: JSON.stringify(book)};
    
    // act
    const response = await handler(event);

    // assert
    expect(dynamoDbStub).to.have.been.calledWith({
      TableName: 'books',
      Item: { 
          isbn: {S: book.isbn},
          title: {S: book.title},
          year: {N: book.year.toString()},
          author: {S: book.author},
          publisher: {S: book.publisher},
          rating: {N: book.rating.toString()},
          pages: {N: book.pages.toString()}
      }
    });
    expect(response).to.deep.equal({
      statusCode: 201,
      headers: {'Content-Type': 'application/json'},
      body: ""
    });
  });

  it('should return an error if event body is incorrect', async () => {
    // arrange
    dynamoDbStub = sandbox.stub().callsFake((params, cb) => cb(null));
    AWSMock.mock('DynamoDB', 'putItem', dynamoDbStub);
    
    const invalidBook = {};
    const event = {body: JSON.stringify(invalidBook)};

    // act
    const response = await handler(event);
    
    // assert
    expect(dynamoDbStub).to.not.have.been.called;
    expect(response).to.deep.equal({
      statusCode: 500,
      headers: {},
      body: ''
    });
  });

  it('should return an error if call to DynamoDB fails', async () => {
    // arrange
    dynamoDbStub = sandbox.stub().callsFake((params, cb) => cb('Error'));
    AWSMock.mock('DynamoDB', 'putItem', dynamoDbStub);
    
    const book = buildBook();
    const event = {body: JSON.stringify(book)};
    
    // act
    const response = await handler(event);

    // assert
    expect(dynamoDbStub).to.have.been.calledWith({
      TableName: 'books',
      Item: { 
          isbn: {S: book.isbn},
          title: {S: book.title},
          year: {N: book.year.toString()},
          author: {S: book.author},
          publisher: {S: book.publisher},
          rating: {N: book.rating.toString()},
          pages: {N: book.pages.toString()}
      }
    });
    expect(response).to.deep.equal({
      statusCode: 500,
      headers: {},
      body: ''
    });
  });

  function buildBook(): Book {
    return {
      isbn: '1',
      title: 'foo',
      year: 2000,
      author: 'bar',
      publisher: 'baz',
      rating: 1,
      pages: 100
    };
  }

});