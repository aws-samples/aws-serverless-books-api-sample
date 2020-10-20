// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { APIGatewayProxyResult } from 'aws-lambda';
import * as AWSCore from 'aws-sdk';
import * as AWSXRay from 'aws-xray-sdk-core';

let AWS;

const ddbOptions: AWSCore.DynamoDB.Types.ClientConfiguration = {
  apiVersion: '2012-08-10'
};

// https://github.com/awslabs/aws-sam-cli/issues/217
if (process.env.AWS_SAM_LOCAL) {
  AWS = AWSCore;
  ddbOptions.endpoint = 'http://dynamodb:8000';
} else {
  AWS = AWSXRay.captureAWS(AWSCore);
}

async function handler(event: any): Promise<APIGatewayProxyResult> {
  let response: APIGatewayProxyResult;
  try {
    const client = new AWS.DynamoDB(ddbOptions);

    const book = JSON.parse(event.body);
    const { isbn, title, year, author, publisher, rating, pages } = book;

    const params: AWS.DynamoDB.Types.PutItemInput = {
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
    await client.putItem(params).promise();

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