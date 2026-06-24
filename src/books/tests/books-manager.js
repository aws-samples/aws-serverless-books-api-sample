// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { BatchWriteItemCommand, DynamoDBClient, GetItemCommand } = require('@aws-sdk/client-dynamodb');
const client = new DynamoDBClient({});

const table = process.env.TABLE || 'books';

const save = async (books) => {
  try {
    const putRequests = [];
    for (let book of books) {
      putRequests.push({
        PutRequest: {
          Item: {
            isbn: { S: book.isbn },
            title: { S: book.title },
            year: { N: book.year.toString() },
            author: { S: book.author },
            publisher: { S: book.publisher },
            rating: { N: book.rating.toString() },
            pages: { N: book.pages.toString() }
          }
        }
      })
    }
  
    const params = {
      RequestItems: {
        [table]: putRequests
      }
    };
  
    await client.send(new BatchWriteItemCommand(params));
  } catch (e) {
    console.log('error saving test books into dynamodb', e);
    throw e;
  }
  
};

const remove = async (books) => {
  try {
    const deleteRequests = [];
    for (let book of books) {
      deleteRequests.push({
        DeleteRequest: {
          Key: {
            isbn: { S: book.isbn }
          }
        }
      })
    }
  
    const params = {
      RequestItems: {
        [table]: deleteRequests
      }
    };
  
    await client.send(new BatchWriteItemCommand(params));
  } catch (e) {
    console.log('error removing test books from dynamodb', e);
    throw e;
  }
};

const get = async book => {
  try {
    const params = {
      TableName: table,
      Key: {
        'isbn': {S: book.isbn}
      }
    };
  
    const result = await client.send(new GetItemCommand(params));
    return {
      isbn: result.Item.isbn.S,
      title: result.Item.title.S,
      year: parseInt(result.Item.year.N, 10),
      author: result.Item.author.S,
      publisher: result.Item.publisher.S,
      rating: parseInt(result.Item.rating.N, 10),
      pages: parseInt(result.Item.pages.N, 10)
    };
  } catch (e) {
    console.log('error retrieving test book from dynamodb', e);
    throw e;
  }
}

const find = (book, list) => {
  for (e of list) {
    if (e.isbn === book.isbn) return e;
  }
}

exports.save = save;
exports.remove = remove;
exports.get = get;
exports.findBookInList = find;
