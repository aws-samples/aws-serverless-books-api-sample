// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { CodeDeployClient, LifecycleEventStatus, PutLifecycleEventHookExecutionStatusCommand } from '@aws-sdk/client-codedeploy';
import { DeleteItemCommand, DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';

const cdClient = new CodeDeployClient({});
const lambdaClient = new LambdaClient({});
const ddbClient = new DynamoDBClient({});

const tableName = process.env.TABLE || 'books';

exports.handler = async (event: any)  => {
    let status: LifecycleEventStatus = LifecycleEventStatus.SUCCEEDED;
    try {
        console.log('Entering PreTraffic Hook!');

        console.log('CodeDeploy event', event);
	
        const functionToTest = process.env.FN_NEW_VERSION || 'books-create';
        console.log('Testing new function version: ' + functionToTest);
    
        const book = {isbn: '1-111-111-111', title: 'Smoke Test', year: '1111', author: 'Test', publisher: 'Test', rating: 1, pages: 111};
        const request = {
          body: JSON.stringify(book)
        }

        const lParams = {
            FunctionName: functionToTest,
            Payload: JSON.stringify(request)
        };
        await lambdaClient.send(new InvokeCommand(lParams));
        
        const ddbParams = {
            TableName: tableName,
            Key: {isbn: {S: book.isbn}},
            ConsistentRead: true
        };

        console.log('DynamoDB getItem params', JSON.stringify(ddbParams, null, 2));
        await wait();
        const {Item} = await ddbClient.send(new GetItemCommand(ddbParams));
        console.log('DynamoDB item', JSON.stringify(Item, null, 2));

        if (!Item) {
            throw new Error('Test book not inserted in DynamoDB');
        }

        await ddbClient.send(new DeleteItemCommand({
            TableName: tableName,
            Key: {isbn: {S: book.isbn}}
        }));
        console.log('Test DynamoDB item deleted');

    } catch (e) {
        console.log(e);
        status = LifecycleEventStatus.FAILED;
    }

    const cdParams = {
        deploymentId: event.DeploymentId,
        lifecycleEventHookExecutionId: event.LifecycleEventHookExecutionId,
        status
    };

    return await cdClient.send(new PutLifecycleEventHookExecutionStatusCommand(cdParams));
};

function wait(ms?: number) {
    const t = ms || 1500;
    return new Promise(resolve => {
        setTimeout(resolve, t);
    });
}
