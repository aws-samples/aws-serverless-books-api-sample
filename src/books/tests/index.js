// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const axios = require('axios');
const { expect } = require('chai');

const {v4: uuidv4} = require('uuid');
const AWS = require('aws-sdk');

const manager = require('./books-manager');

const region = process.env.AWS_REGION;

const cognitoServiceProvider = new AWS.CognitoIdentityServiceProvider({
  apiVersion: '2016-04-18',
  region
});

describe('End-to-end tests for Book API', () => {
  const apiEndpoint = process.env.API_ENDPOINT;
  const booksEndpoint = `${apiEndpoint}books`;

  const username = `success+${uuidv4()}@simulator.amazonses.com`; 
  const userPoolId = process.env.USER_POOL_ID;
  const userPoolClientId = process.env.USER_POOL_CLIENT_ID;
  const password = uuidv4();

  let token;

  before(async () => {
    await createUser();
    const accessToken = await getAccessToken();
    token = `Bearer ${accessToken}`;
  });

  after(deleteUser);

  context('Getting all books', () => {

    it('should not required authentication', async () => {
      // act
      return axios
        .get(booksEndpoint)
        .then(response => {
          // assert
          expect(response).to.have.property('status', 200);
        });
    });

    it('should return books', async () => {
      // arrange
      const n = 5;
      const booksToCreate = buildBooks(n);
      await manager.save(booksToCreate);

      // act
      return axios
        .get(booksEndpoint)
        .then(response => {
          // assert
          expect(response).to.have.property('status', 200);

          const {data} = response;
          expect(data).to.have.lengthOf(n);
          for (let i = 0; i < n; i++) {
            const book = data[i];
            const expectedBook = manager.findBookInList(book, booksToCreate);
            expect(expectedBook).to.deep.equal(book);
          }

          // clean up
          return manager.remove(booksToCreate);
        })
        .catch(async e => {
          // clean up
          await manager.remove(booksToCreate);
          return Promise.reject(e);
        });
    });
  });

  context('Creating a new book', () => {

    it('should not allow to create a book without token', async () => {
      // act
      return axios
        .post(booksEndpoint, buildBooks(1)[0])
        .catch(result => {
          // assert
          const {response} = result;
          expect(response).to.have.property('status', 401);
        });
    });
  
    it('should return an error if payload doesnt match expected schema', async () => {
      // arrange
      const incorrectBook = buildBooks(1)[0];
      delete incorrectBook.publisher;

      // act
      return axios
        .post(booksEndpoint, incorrectBook, {headers: {Authorization: token}})
        .catch(result => {
          // assert
          const {response} = result;
          expect(response).to.have.property('status', 500);
        });
    });

    it('should create a new book', async () => {
      // arrange
      const book = buildBooks(1)[0];

      // act
      return axios
        .post(booksEndpoint, book, {headers: {Authorization: token}})
        .then(async response  => {
          // assert
          expect(response).to.have.property('status', 201);

          const savedBook = await manager.get(book);
          expect(book).to.deep.equal(savedBook);

          // clean up
          await manager.remove([book]);
        })
        .catch(async e => {
          // clean up
          await manager.remove([book]);
          return Promise.reject(e);
        });
    });
  });

  async function createUser() {
    // create user
    const createUserParams = {
      UserPoolId: userPoolId,
      Username: username,
      UserAttributes: [{
        Name: 'email_verified', Value: 'True'
      }, {
        Name: 'email', Value: username
      }]
    };
    const createUserResponse = await cognitoServiceProvider.adminCreateUser(createUserParams).promise();
    
    // confirm user
    const setPwParams = {
      UserPoolId: userPoolId,
      Username: username,
      Password: password,
      Permanent: true
    };
    await cognitoServiceProvider.adminSetUserPassword(setPwParams).promise();
    
    return createUserResponse.User;
  }

  async function getAccessToken() {
    const params = {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: userPoolClientId,
      AuthParameters: {
        'USERNAME': username,
        'PASSWORD': password
      }
    }
    const response = await cognitoServiceProvider.initiateAuth(params).promise();
    return response.AuthenticationResult.AccessToken;
  }

  async function deleteUser() {
    const deleteUserParams = {
      UserPoolId: userPoolId,
      Username: username
    };
    
    return cognitoServiceProvider.adminDeleteUser(deleteUserParams).promise();
  }

  function buildBooks(count) {
    count = count || 1;
    const books = [];
    for (let i = 0; i < count; i++) {
      books.push({
        isbn: uuidv4(),
        title: `title_${i}`,
        year: parseInt(`200${i}`, 10),
        author: `author_${i}`,
        publisher: `publisher_${i}`,
        rating: i,
        pages: parseInt(`10${i}`, 10)
      });
    }
    return books;
  }
});