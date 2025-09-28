const FB = require('fb').default;

// Ensure we use the latest Graph API version available in the SDK
FB.options({ version: 'v21.0' });

function createFacebookClient(accessToken) {
  if (!accessToken) {
    throw new Error('Facebook access token is required to create a client');
  }

  const client = FB.extend({ accessToken });

  return {
    async api(path, method = 'get', params = {}) {
      return new Promise((resolve, reject) => {
        client.api(path, method, params, (response) => {
          if (!response) {
            return reject(new Error('No response received from Facebook API'));
          }

          if (response.error) {
            const error = new Error(response.error.message || 'Facebook API error');
            error.code = response.error.code;
            error.type = response.error.type;
            error.fbError = response.error;
            return reject(error);
          }

          resolve(response);
        });
      });
    }
  };
}

module.exports = { createFacebookClient };
