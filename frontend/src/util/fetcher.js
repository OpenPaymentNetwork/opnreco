
// Fetcher for OPN and OPN Reports services.

/* global process: false */

import { logOut } from '../reducer/login';

import { tokenRefreshRequest, tokenRefreshCancel, setServerError }
  from '../reducer/app';


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


export class OPNFetcher {

  constructor(baseURL, config) {
    this.baseURL = baseURL;
    this.config = config;
  }

  fetchURL = (url, options = {}) => (dispatch, getState) => {
    /* Extract fetcher-specific options from the fetch options. */
    const {
      customAuth,
      data,
      isCurrent,
      token: tokenOption,
      disableTokenRefresh,
      suppressServerError,
      ...fetchOptions
    } = options;

    if (!fetchOptions.headers) {
      fetchOptions.headers = {};
    }

    const setAuthHeader = !customAuth && !fetchOptions.headers.Authorization;

    if (!fetchOptions.headers.Accept) {
      fetchOptions.headers.Accept = 'application/json';
    }

    if (data) {
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(options.data);
      if (!fetchOptions.method) {
        fetchOptions.method = 'post';
      }
    }

    return new Promise((resolve, reject) => {
      function tryFetch(token) {
        if (token && setAuthHeader) {
          fetchOptions.headers.Authorization = 'Bearer ' + token;
        }

        return fetch(url, fetchOptions)
          .then(checkAndParse)
          .then(resolve)
          .catch((error) => {
            if (isCurrent && !isCurrent()) {
              // This fetch is no longer current. Propagate the error,
              // but don't refresh tokens or show server errors.
              reject(error);
              return;
            }

            if (token && error.response && error.response.status === 401) {
              if (disableTokenRefresh) {
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
                // If refresh succeeds, re-fetch and resolve the promise.
                const deferred = {
                  resolve: (newToken) => {
                    tryFetch(newToken);
                  },
                  reject: () => {
                    reject(error);
                  },
                };
                dispatch(tokenRefreshRequest(deferred));
              }
            } else if (!suppressServerError) {
              let e = error;
              if (error.message &&
                (error.message === 'Type error' ||
                  error.message === 'Failed to fetch')) {
                e = 'An error occurred while contacting the server.';
              }
              /* eslint {"no-console": 0} */
              if (typeof console !== 'undefined') {
                console.error('Server error', {
                  url,
                  fetchOptions,
                  error,
                });
              }
              dispatch(setServerError(e));
              reject(error);
            }
          });
      }

      let initToken = tokenOption;
      if (!initToken && this.config.useToken) {
        initToken = getState().login.token;
      }
      tryFetch(initToken);
    });

  };

  pathToURL(path) {
    return this.baseURL + path;
  }

  fetchPath(path, options = {}) {
    return this.fetchURL(this.pathToURL(path), options);
  }
}


export const fOPN = new OPNFetcher(
  process.env.REACT_APP_OPN_API_URL, {useToken: true});

export const fOPNReport = new OPNFetcher(
  process.env.REACT_APP_OPNREPORT_API_URL, {useToken: true});
