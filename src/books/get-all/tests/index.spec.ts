// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as chai from 'chai';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, ScanCommand, ScanCommandOutput } from '@aws-sdk/client-dynamodb';

const expect = chai.expect;

import { v4 as uuidv4, validate as uuidValidate } from 'uuid';

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
  const dynamoDbMock = mockClient(DynamoDBClient);

  beforeEach(() => {
    dynamoDbMock.reset();
  });

  it('should get all books from dynamodb', async () => {
    // arrange
    const booksFromDb = buildDynamoDbBooks();
    dynamoDbMock.on(ScanCommand).resolves(booksFromDb);

    // act
    const response = await handler();

    // assert
    expect(dynamoDbMock.commandCalls(ScanCommand, {
      TableName: 'books'
    })).to.have.length(1);
    expect(response).to.have.property('statusCode', 200);
    expect(response).to.have.deep.property('headers', { 'Content-Type': 'application/json' });
    expect(response).to.have.property('body');

    const books: Book[] = JSON.parse(response.body);
    expect(books).to.have.length(2);
    for(let book of books) {
      expect(book).to.not.null;
      expect(uuidValidate(book.isbn)).to.be.true;
      expect(book).to.have.property('title', 'a');
      expect(book).to.have.property('year', 2000);
      expect(book).to.have.property('author', 'b');
      expect(book).to.have.property('publisher', 'c');
      expect(book).to.have.property('rating', 5);
      expect(book).to.have.property('pages', 100);
    }
  });

  it('should get no books from dynamodb', async () => {
    // arrange
    dynamoDbMock.on(ScanCommand).resolves({Items: []});

    // act
    const response = await handler();

    // assert
    expect(dynamoDbMock.commandCalls(ScanCommand, {
      TableName: 'books'
    })).to.have.length(1);
    expect(response).to.have.property('statusCode', 200);
    expect(response).to.have.deep.property('headers', { 'Content-Type': 'application/json' });
    expect(response).to.have.property('body');

    const books: Book[] = JSON.parse(response.body);
    expect(books).to.have.length(0);
  });

  it('should return an error if call to DynamoDB fails', async () => {
    // arrange
    dynamoDbMock.on(ScanCommand).rejects('Error');
    
    // act
    const response = await handler();

    // assert
    expect(dynamoDbMock.commandCalls(ScanCommand, {
      TableName: 'books'
    })).to.have.length(1);
    expect(response).to.deep.equal({
      statusCode: 500,
      headers: {},
      body: ''
    });
  });

  function buildDynamoDbBooks(count: number = 2) {
    const books: ScanCommandOutput = {$metadata: {}, Items: []};
    for (let i = 0; i < count; i++) {
      books.Items?.push({
        isbn: { S: uuidv4() },
        title: { S: 'a' },
        year: { N: '2000' },
        author: { S: 'b' },
        publisher: { S: 'c' },
        rating: { N: '5' },
        pages: { N: '100' }
      });
    }
    return books;
  }

});
