// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import {CodeDeploy, Lambda, DynamoDB} from 'aws-sdk';

const cdClient = new CodeDeploy({apiVersion: '2014-10-06'});
const lambdaClient = new Lambda();
const ddbClient = new DynamoDB({apiVersion: '2012-08-10'});

const tableName = process.env.TABLE || 'books';

exports.handler = async (event: any)  => {
    let status = 'Succeeded';
    try {
        console.log('Entering PreTraffic Hook!');

        console.log('CodeDeploy event', event);
	
        const functionToTest = process.env.FN_NEW_VERSION || 'books-create';
        console.log('Testing new function version: ' + functionToTest);
    
        const book = {isbn: '1-111-111-111', title: 'Smoke Test', year: '1111', author: 'Test', publisher: 'Test', rating: 1, pages: 111};
        const request = {
          body: JSON.stringify(book)
        }

        const lParams: Lambda.Types.InvocationRequest = {
            FunctionName: functionToTest,
            Payload: JSON.stringify(request)
        };
        await lambdaClient.invoke(lParams).promise();
        
        const ddbParams: DynamoDB.Types.GetItemInput = {
            TableName: tableName,
            Key: {isbn: {S: book.isbn}},
            ConsistentRead: true
        };

        console.log('DynamoDB getItem params', JSON.stringify(ddbParams, null, 2));
        await wait();
        const {Item} = await ddbClient.getItem(ddbParams).promise();
        console.log('DynamoDB item', JSON.stringify(Item, null, 2));

        if (!Item) {
            throw new Error('Test book not inserted in DynamoDB');
        }

        delete ddbParams.ConsistentRead;
        await ddbClient.deleteItem(ddbParams).promise();
        console.log('Test DynamoDB item deleted');

    } catch (e) {
        console.log(e);
        status = 'Failed';
    }

    const cdParams: CodeDeploy.Types.PutLifecycleEventHookExecutionStatusInput = {
        deploymentId: event.DeploymentId,
        lifecycleEventHookExecutionId: event.LifecycleEventHookExecutionId,
        status
    };

    return await cdClient.putLifecycleEventHookExecutionStatus(cdParams).promise();
};

function wait(ms?: number) {
    const t = ms || 1500;
    return new Promise(resolve => {
        setTimeout(resolve, t);
    });
}