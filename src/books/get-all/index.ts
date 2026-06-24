// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, DynamoDBClientConfig, ScanCommand } from '@aws-sdk/client-dynamodb';
import * as AWSXRay from 'aws-xray-sdk-core';

const ddbOptions: DynamoDBClientConfig = {};

// https://github.com/awslabs/aws-sam-cli/issues/217
if (process.env.AWS_SAM_LOCAL) {
  ddbOptions.endpoint = 'http://dynamodb:8000';
}

const client = process.env.AWS_SAM_LOCAL
  ? new DynamoDBClient(ddbOptions)
  : AWSXRay.captureAWSv3Client(new DynamoDBClient(ddbOptions));

async function handler(): Promise<APIGatewayProxyResult> {
  let response: APIGatewayProxyResult;
  try {
    const params = {
      TableName: process.env.TABLE || 'books'
    };

    const result = await client.send(new ScanCommand(params));

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
