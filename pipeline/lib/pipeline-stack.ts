import * as cdk from '@aws-cdk/core';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as ssm from '@aws-cdk/aws-ssm';

import { CodeBuildAction, GitHubSourceAction, ManualApprovalAction } from '@aws-cdk/aws-codepipeline-actions';
import { Bucket, BucketEncryption } from '@aws-cdk/aws-s3';

export class PipelineStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const accountId = this.account;

    // Bucket for pipeline artifacts
    const pipelineArtifactBucket = new Bucket(this, 'CiCdPipelineArtifacts', {
      bucketName: `ci-cd-pipeline-artifacts-${accountId}`,
      encryption: BucketEncryption.S3_MANAGED
    });

    const apiArtifactBucket = new Bucket(this, 'ApiArtifacts', {
      bucketName: `books-api-artifacts-${accountId}`,
      encryption: BucketEncryption.S3_MANAGED
    });

    // Source (https://docs.aws.amazon.com/cdk/api/latest/docs/aws-codepipeline-actions-readme.html)
    const sourceArtifacts = new codepipeline.Artifact();
    const sourceAction: GitHubSourceAction = new codepipeline_actions.GitHubSourceAction({
      actionName: 'Source',
      owner: ssm.StringParameter.fromStringParameterName(this, 'GithubUsername', 'github_username').stringValue,
      repo: 'aws-api-gateway-sam',
      oauthToken: cdk.SecretValue.secretsManager('github_token', {jsonField: 'github_token'}),
      output: sourceArtifacts,
      branch: 'main',
      trigger: codepipeline_actions.GitHubTrigger.WEBHOOK,
      variablesNamespace: 'SourceVariables'
    });

    // Build
    const buildProject = new codebuild.PipelineProject(this, 'CiCdBuild', {
      buildSpec: codebuild.BuildSpec.fromSourceFilename('pipeline/buildspec.json'),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_3_0
      },
      projectName: 'books-api-build'
    });

    apiArtifactBucket.grantPut(buildProject);

    const buildArtifacts = new codepipeline.Artifact();
    const buildAction: CodeBuildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'Build',
      input: sourceArtifacts,
      environmentVariables: {
        S3_BUCKET: {value: apiArtifactBucket.bucketName},
        GIT_BRANCH: {value: sourceAction.variables.branchName}
      },
      project: buildProject,
      variablesNamespace: 'BuildVariables',
      outputs: [buildArtifacts]
    });

    // Deploy
    const deployProject = new codebuild.PipelineProject(this, 'CiCdDeploy', {
      buildSpec: codebuild.BuildSpec.fromSourceFilename('pipeline/buildspec-deploy.json'),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_3_0
      },
      projectName: 'books-api-deploy'
    });

    apiArtifactBucket.grantRead(deployProject);
    deployProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/AWSCloudFormationFullAccess'});
    deployProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess'});
    deployProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/AWSLambdaFullAccess'});
    deployProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonAPIGatewayAdministrator'});
    deployProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/IAMFullAccess'});
    deployProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/AWSCodeDeployFullAccess'});
    deployProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonCognitoPowerUser'});

    // Deploy to staging
    const deployToStagingAction: CodeBuildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'Deploy',
      input: sourceArtifacts,
      environmentVariables: {
        STACK_NAME: {value: 'BooksApiStaging'},
        ENVIRONMENT: {value: 'staging'},
        ARTIFACTS_PATH: {value: buildAction.variable('ARTIFACTS_PATH')}
      },
      variablesNamespace: 'StagingVariables',
      project: deployProject,
      runOrder: 1
    });

    // End to end tests
    const testProject = new codebuild.PipelineProject(this, 'CiCdTest', {
      buildSpec: codebuild.BuildSpec.fromSourceFilename('pipeline/buildspec-test.json'),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_3_0
      },
      projectName: 'books-api-test'
    });
    
    testProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonCognitoPowerUser'});
    testProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess'});

    const testAction: CodeBuildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'Test',
      input: sourceArtifacts,
      environmentVariables: {
        API_ENDPOINT: {value: deployToStagingAction.variable('API_ENDPOINT')},
        USER_POOL_ID: {value: deployToStagingAction.variable('USER_POOL_ID')},
        USER_POOL_CLIENT_ID: {value: deployToStagingAction.variable('USER_POOL_CLIENT_ID')},
        TABLE: {value: deployToStagingAction.variable('TABLE')}
      },
      project: testProject,
      runOrder: 2
    });

    // Deploy to production
    const manualApprovalAction: ManualApprovalAction = new codepipeline_actions.ManualApprovalAction({
      actionName: 'Review',
      additionalInformation: 'Ensure Books API works correctly in Staging and release date is agreed with Product Owners',
      runOrder: 1
    });

    const deployToProductionAction: CodeBuildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'Deploy',
      input: sourceArtifacts,
      environmentVariables: {
        STACK_NAME: {value: 'BooksApiProduction'},
        ENVIRONMENT: {value: 'production'},
        ARTIFACTS_PATH: {value: buildAction.variable('ARTIFACTS_PATH')}
      },
      project: deployProject,
      runOrder: 2
    });

    // Pipeline
    new codepipeline.Pipeline(this, 'CiCdPipeline', {
      pipelineName: 'BooksApi',
      artifactBucket: pipelineArtifactBucket,
      stages: [
        {
          stageName: 'Source',
          actions: [sourceAction],
        }, {
          stageName: 'Build',
          actions: [buildAction]
        }, {
          stageName: 'Staging',
          actions: [deployToStagingAction, testAction]
        }, {
          stageName: 'Production',
          actions: [manualApprovalAction, deployToProductionAction]
        }
      ]
    });
  }
}
