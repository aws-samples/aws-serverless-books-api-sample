// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, DynamoDBClientConfig, PutItemCommand } from '@aws-sdk/client-dynamodb';
import * as AWSXRay from 'aws-xray-sdk-core';

const ddbOptions: DynamoDBClientConfig = {};

// https://github.com/awslabs/aws-sam-cli/issues/217
if (process.env.AWS_SAM_LOCAL) {
  ddbOptions.endpoint = 'http://dynamodb:8000';
}

const client = process.env.AWS_SAM_LOCAL
  ? new DynamoDBClient(ddbOptions)
  : AWSXRay.captureAWSv3Client(new DynamoDBClient(ddbOptions));

async function handler(event: any): Promise<APIGatewayProxyResult> {
  let response: APIGatewayProxyResult;
  try {
    const book = JSON.parse(event.body);
    const { isbn, title, year, author, publisher, rating, pages } = book;

    const params = {
      TableName: process.env.TABLE || 'books',
      Item: {
        isbn: { S: isbn },
        title: { S: title },
        year: { N: year.toString() },
        author: { S: author },
        publisher: { S: publisher },
        rating: { N: rating.toString() },
        pages: { N: pages.toString() }
      }
    };
    await client.send(new PutItemCommand(params));

    response = {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: ''
    };

  } catch (e) {
    response = {
      statusCode: 500,
      headers: {},
      body: ''
    };
  }
  return response;
}

export { handler };
