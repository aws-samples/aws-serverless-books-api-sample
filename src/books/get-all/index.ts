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

async function handler(): Promise<APIGatewayProxyResult> {
  let response: APIGatewayProxyResult;
  try {
    const client = new AWS.DynamoDB(ddbOptions);

    const params: AWS.DynamoDB.Types.ScanInput = {
      TableName: process.env.TABLE || 'books'
    };

    const result: AWS.DynamoDB.Types.ScanOutput = await client.scan(params).promise();

    const bookDtos = result.Items?.map(item => ({
      isbn: item['isbn'].S,
      title: item['title'].S,
      year: parseInt(item['year'].N!, 10),
      author: item['author'].S,
      publisher: item['publisher'].S,
      rating: parseInt(item['rating'].N!, 10),
      pages: parseInt(item['pages'].N!, 10)
    }));

    response = {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookDtos)
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