
import { logOut, tokenRefreshStart, tokenRefreshCancel }
  from '../reducer/login';
import { setServerError } from '../reducer/app';


/* global process: false */


function checkAndParse(response) {
  let contentPromise;
  try {
    contentPromise = response.json();
  } catch (e) {
    contentPromise = {};
  }

  return new Promise((resolve, reject) => {
    function handleContent(content) {
      if (response.status >= 200 && response.status < 300) {
        resolve(content);
      } else {
        const message = (
          content && content.error
            ? (content.error_description || content.error)
            : response.statusText);
        const error = new Error(message);
        error.response = response;
        error.content = content;
        if (typeof console !== 'undefined') {
          /* eslint {"no-console": [0]} */
          console.error(error);
        }
        reject(error);
      }
    }

    Promise.resolve(contentPromise)
      .then(handleContent).catch(() => {
        handleContent(null);
      });
  });
}


export const callAPI = (path, options = {}) => (dispatch, getState) => {

  const state = getState();

  const baseURL = process.env.REACT_APP_OPN_API_URL;
  const url = baseURL + path;

  const customAuth = options.headers && options.headers.Authorization;

  const fetchOptions = {
    ...(options.fetchOptions || {}),
    headers: {
      'Accept': 'application/json',
      ...(options.headers || {}),
    },
  };

  return new Promise((resolve, reject) => {
    function tryCall(token) {
      if (token && !customAuth) {
        fetchOptions.headers.Authorization = 'Bearer ' + token;
      }

      return fetch(url, fetchOptions)
        .then(checkAndParse)
        .then(resolve)
        .catch((error) => {
          if (token && error.response && error.response.status === 401) {
            if (error.content && error.content.token_error &&
                error.content.token_error !== 'token_expired_soft') {
              dispatch(tokenRefreshCancel());
              dispatch(logOut());
              reject(error);
            } else {
              const deferred = {
                resolve: (newToken) => {
                  tryCall(newToken);
                },
                reject: () => {
                  reject(error);
                },
              };
              dispatch(tokenRefreshStart(deferred));
            }
          } else if (!options.suppressErrorDialog) {
            let e = error;
            if (error.message &&
              (error.message === 'Type error' ||
                error.message === 'Failed to fetch')) {
              e = 'An error occurred while contacting the server.';
            }
            dispatch(setServerError(e));
            reject(error);
          }
        });
    }

    tryCall(options.token || state.login.token);
  });
};
