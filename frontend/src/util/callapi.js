
import { logOut } from '../reducer/login';

import { tokenRefreshRequest, tokenRefreshCancel, setServerError }
  from '../reducer/app';


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
        reject(error);
      }
    }

    Promise.resolve(contentPromise)
      .then(handleContent).catch(() => {
        handleContent(null);
      });
  });
}


export const callAPI = (url, options = {}) => (dispatch, getState) => {

  const state = getState();

  const customAuth = options.customAuth || (
    options.headers && options.headers.Authorization);

  const fetchOptions = {
    ...(options.fetchOptions || {}),
    headers: {
      'Accept': 'application/json',
      ...(options.headers || {}),
    },
  };

  if (options.data) {
    fetchOptions.headers['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify(options.data);
    if (!options.method) {
      fetchOptions.method = 'post';
    }
  }

  if (options.method) {
    fetchOptions.method = options.method;
  }

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
            if (options.disableRefresh) {
              // Instead of refreshing access tokens automatically,
              // propagate Unauthorized errors to the caller.
              reject(error);
            } else if (error.content && error.content.token_error &&
                error.content.token_error !== 'token_expired_soft') {
              // Don't bother trying to refresh the access token. It won't
              // work except when token_error is 'token_expired_soft'.
              dispatch(tokenRefreshCancel());
              dispatch(logOut());
              reject(error);
            } else {
              // Try to refresh the access token.
              const deferred = {
                resolve: (newToken) => {
                  tryCall(newToken);
                },
                reject: () => {
                  reject(error);
                },
              };
              dispatch(tokenRefreshRequest(deferred));
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


export function callOPNAPI(path, options = {}) {
  const baseURL = process.env.REACT_APP_OPN_API_URL;
  const url = baseURL + path;
  return callAPI(url, options);
}


export function callOPNReportAPI(path, options = {}) {
  const baseURL = process.env.REACT_APP_OPNREPORT_API_URL;
  const url = baseURL + path;
  return callAPI(url, options);
}
