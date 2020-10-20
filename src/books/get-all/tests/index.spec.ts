// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';

chai.use(sinonChai);
const expect = chai.expect;

import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import * as AWSMock from 'aws-sdk-mock';
import * as AWS from 'aws-sdk';

import { handler } from '../index';

interface Book {
  isbn: string;
  title: string;
  year: number;
  author: string;
  publisher: string;
  rating: number;
  pages: number;
};

describe('get all book tests', () => {
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

  it('should get all books from dynamodb', async () => {
    // arrange
    const booksFromDb = buildDynamoDbBooks();
    dynamoDbStub = sandbox.stub().callsFake((params, cb) => cb(null, booksFromDb));
    AWSMock.mock('DynamoDB', 'scan', dynamoDbStub);

    // act
    const response = await handler();

    // assert
    expect(dynamoDbStub).to.have.been.calledWith({
      TableName: 'books'
    });
    expect(response).to.have.property('statusCode', 200);
    expect(response).to.have.deep.property('headers', { 'Content-Type': 'application/json' });
    expect(response).to.have.property('body');

    const books: Book[] = JSON.parse(response.body);
    expect(books).to.have.length(2);
    for(let book of books) {
      expect(book).to.not.null;
      expect(uuidValidate(book.isbn)).to.be.true;
      expect(book).to.have.property('title');
      expect(book).to.have.property('year');
      expect(book).to.have.property('author');
      expect(book).to.have.property('publisher');
      expect(book).to.have.property('rating');
      expect(book).to.have.property('pages');
    }
  });

  it('should get no books from dynamodb', async () => {
    // arrange
    dynamoDbStub = sandbox.stub().callsFake((params, cb) => cb(null, {Items:[]}));
    AWSMock.mock('DynamoDB', 'scan', dynamoDbStub);

    // act
    const response = await handler();

    // assert
    expect(dynamoDbStub).to.have.been.calledWith({
      TableName: 'books'
    });
    expect(response).to.have.property('statusCode', 200);
    expect(response).to.have.deep.property('headers', { 'Content-Type': 'application/json' });
    expect(response).to.have.property('body');

    const books: Book[] = JSON.parse(response.body);
    expect(books).to.have.length(0);
  });

  it('should return an error if call to DynamoDB fails', async () => {
    // arrange
    dynamoDbStub = sandbox.stub().callsFake((params, cb) => cb('Error'));
    AWSMock.mock('DynamoDB', 'scan', dynamoDbStub);
    
    // act
    const response = await handler();

    // assert
    expect(dynamoDbStub).to.have.been.calledWith({
      TableName: 'books'
    });
    expect(response).to.deep.equal({
      statusCode: 500,
      headers: {},
      body: ''
    });
  });

  function buildDynamoDbBooks(count: number = 2) {
    const books: AWS.DynamoDB.ScanOutput = { Items: [] };
    for (let i = 0; i < count; i++) {
      books.Items?.push({
        isbn: { S: uuidv4() },
        title: { S: '1' },
        year: { N: '2000' },
        author: { S: '1' },
        publisher: { S: '1' },
        rating: { N: '1' },
        pages: { N: '100' }
      });
    }
    return books;
  }

});