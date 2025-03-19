import { Construct } from 'constructs';
import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";

import { Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { CodeBuildAction, CodeStarConnectionsSourceAction, ManualApprovalAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import { BuildSpec, LinuxBuildImage, PipelineProject } from 'aws-cdk-lib/aws-codebuild';

export class PipelineStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const accountId = this.account;

    // Source
    const gitOwner = 'aws-samples';
    const gitRepo = 'aws-serverless-books-api-sample';
    const gitBranch = 'main';
    
    // Bucket for pipeline artifacts
    const pipelineArtifactBucket = new Bucket(this, 'CiCdPipelineArtifacts', {
      bucketName: `ci-cd-pipeline-artifacts-${accountId}`,
      encryption: BucketEncryption.S3_MANAGED,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const apiArtifactBucket = new Bucket(this, 'ApiArtifacts', {
      bucketName: `books-api-artifacts-${accountId}`,
      encryption: BucketEncryption.S3_MANAGED,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,      
    });

    const sourceArtifacts = new Artifact();
    const sourceAction = new CodeStarConnectionsSourceAction({
      actionName: 'Source',
      owner: gitOwner,
      repo: gitRepo,
      branch: gitBranch,
      connectionArn: StringParameter.fromStringParameterName(this, 'GithubConnectionArn', 'github_connection_arn').stringValue,
      variablesNamespace: 'SourceVariables',
      output: sourceArtifacts
    });

    // Build
    const buildProject = new PipelineProject(this, 'CiCdBuild', {
      buildSpec: BuildSpec.fromSourceFilename('pipeline/buildspec.json'),
      environment: {
        buildImage: LinuxBuildImage.STANDARD_7_0
      },
      projectName: 'books-api-build'
    });

    apiArtifactBucket.grantPut(buildProject);

    const buildArtifacts = new Artifact();
    const buildAction: CodeBuildAction = new CodeBuildAction({
      actionName: 'Build',
      input: sourceArtifacts,
      environmentVariables: {
        S3_BUCKET: {value: apiArtifactBucket.bucketName},
        GIT_BRANCH: {value: gitBranch}
      },
      project: buildProject,
      variablesNamespace: 'BuildVariables',
      outputs: [buildArtifacts]
    });

    // Deploy
    const deployProject = new PipelineProject(this, 'CiCdDeploy', {
      buildSpec: BuildSpec.fromSourceFilename('pipeline/buildspec-deploy.json'),
      environment: {
        buildImage: LinuxBuildImage.STANDARD_7_0
      },
      projectName: 'books-api-deploy'
    });

    apiArtifactBucket.grantRead(deployProject);
    deployProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/AWSCloudFormationFullAccess'});
    deployProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess'});
    deployProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/AWSLambda_FullAccess'});
    deployProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonAPIGatewayAdministrator'});
    deployProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/IAMFullAccess'});
    deployProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/AWSCodeDeployFullAccess'});
    deployProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonCognitoPowerUser'});

    // Deploy to staging
    const deployToStagingAction: CodeBuildAction = new CodeBuildAction({
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
    const testProject = new PipelineProject(this, 'CiCdTest', {
      buildSpec: BuildSpec.fromSourceFilename('pipeline/buildspec-test.json'),
      environment: {
        buildImage: LinuxBuildImage.STANDARD_7_0
      },
      projectName: 'books-api-test'
    });
    
    testProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonCognitoPowerUser'});
    testProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess'});

    const testAction: CodeBuildAction = new CodeBuildAction({
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
    const manualApprovalAction: ManualApprovalAction = new ManualApprovalAction({
      actionName: 'Review',
      additionalInformation: 'Ensure Books API works correctly in Staging and release date is agreed with Product Owners',
      runOrder: 1
    });

    const deployToProductionAction: CodeBuildAction = new CodeBuildAction({
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
    new Pipeline(this, 'CiCdPipeline', {
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
