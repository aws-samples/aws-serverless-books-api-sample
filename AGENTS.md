# Repository Guidance

This project is a SAM application with a CDK-defined CI/CD pipeline. Keep changes scoped to the package or stack being modified.

## Toolchain

- Use Node.js 24 and npm 11. The expected ranges are `node >=24 <25` and `npm >=11 <12`.
- Install dependencies from each package directory with `npm install` or `npm ci`; there is no root `package.json`.
- Package directories:
  - `src/books/create`
  - `src/books/get-all`
  - `src/books/create-pre-traffic`
  - `src/books/tests`
  - `pipeline`

## AWS SDK

- Use explicit AWS SDK v3 clients and commands. Do not add `aws-sdk` v2 or `.promise()` calls.
- Unit tests for Lambda functions use `aws-sdk-client-mock`.
- Runtime code that talks to DynamoDB locally should continue to honor `AWS_SAM_LOCAL`.

## SAM and Deployment

- Preserve environment-specific behavior. `AutoPublishAlias` must continue to reference `Stage`.
- The SAM parameter is `Stage`, with `staging` and `production` as allowed values.
- Lambda runtime should stay aligned with Node.js 24 unless AWS runtime support changes.

## Verification

Run relevant checks before handing off:

```sh
npm test
npm run build
npm audit
sam validate
sam build
cd pipeline && npm run build && cdk synth
```

Run the package commands from the package directories listed above.
