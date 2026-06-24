// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as chai from 'chai';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const expect = chai.expect;

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
  const dynamoDbMock = mockClient(DynamoDBClient);

  beforeEach(() => {
    dynamoDbMock.reset();
  });

  it('should put a book into DynamoDB', async () => {
    // arrange
    dynamoDbMock.on(PutItemCommand).resolves({});
    
    const book = buildBook();
    const event = {body: JSON.stringify(book)};
    
    // act
    const response = await handler(event);

    // assert
    expect(dynamoDbMock.commandCalls(PutItemCommand, {
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
    })).to.have.length(1);
    expect(response).to.deep.equal({
      statusCode: 201,
      headers: {'Content-Type': 'application/json'},
      body: ""
    });
  });

  it('should return an error if event body is incorrect', async () => {
    // arrange
    dynamoDbMock.on(PutItemCommand).resolves({});
    
    const invalidBook = {};
    const event = {body: JSON.stringify(invalidBook)};

    // act
    const response = await handler(event);
    
    // assert
    expect(dynamoDbMock.commandCalls(PutItemCommand)).to.have.length(0);
    expect(response).to.deep.equal({
      statusCode: 500,
      headers: {},
      body: ''
    });
  });

  it('should return an error if call to DynamoDB fails', async () => {
    // arrange
    dynamoDbMock.on(PutItemCommand).rejects('Error');
    
    const book = buildBook();
    const event = {body: JSON.stringify(book)};
    
    // act
    const response = await handler(event);

    // assert
    expect(dynamoDbMock.commandCalls(PutItemCommand, {
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
    })).to.have.length(1);
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
