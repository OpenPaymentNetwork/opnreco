
// FetchCache is a Redux reducer for fetching info from URLs
// and caching the results.

function arraysEqual(a, b) {
  if (!a || !b) {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}


export class FetchCache {

  constructor(config = {}) {
    this.reducerName = config.reducerName || 'fetchcache';

    const actionTypePrefix = config.actionTypePrefix || this.reducerName;
    this.actionTypes = {
      CLEAR: actionTypePrefix + '/CLEAR',
      ERROR: actionTypePrefix + '/ERROR',
      ERROR_STALE: actionTypePrefix + '/ERROR_STALE',
      INJECT: actionTypePrefix + '/INJECT',
      INVALIDATE: actionTypePrefix + '/INVALIDATE',
      RECEIVE: actionTypePrefix + '/RECEIVE',
      RECEIVE_STALE: actionTypePrefix + '/RECEIVE_STALE',
      REQUEST: actionTypePrefix + '/REQUEST',
      REQUIRE: actionTypePrefix + '/REQUIRE',
      RESUME: actionTypePrefix + '/RESUME',
      SUSPEND: actionTypePrefix + '/SUSPEND',
    };

    this.error_expires_ms = config.error_expires_ms || 5 * 1000;  // 5 seconds
    this.expires_ms = config.expires_ms || 30 * 1000;             // 30 seconds
    this.fetch_expires_ms = config.fetch_expires_ms || 5 * 1000;  // 5 seconds
  }

  /**
   * Create and return a reducer for this FetchCache.
   */
  createReducer() {
    const initialState = {
      data: {},
      meta: {},
      requirements: {},
      suspended: false,
    };

    const actionHandlers = this.makeActionHandlers();

    return (state = initialState, action) => {
      const reduceFn = actionHandlers[action.type];
      if (!reduceFn) {
        return state;
      }
      return {...state, ...reduceFn(state, action)};
    };
  }

  /**
   * require(), an action thunk creator,
   * registers component requirements and causes objects to be fetched.
   */
  require(componentId, urls, options = {}) {
    return (dispatch, getState) => {
      const state = getState();
      const newReqsObj = {};
      const newReqsList = [];
      const toFetch = {};
      const oldReqsObj = {};
      let oldReqsList = null;

      if (!urls.forEach) {
        urls = [urls];
      }

      const thisState = state[this.reducerName];

      if (urls.length && thisState.suspended) {
        // Don't add requirements while suspended.
        // Some apps suspend the fetchcache while changing
        // credentials to avoid making requests that would lead
        // to errors.
        // Note that we don't have to save any state in this case
        // because toggling the 'suspended' flag should cause
        // re-registration of all URL requirements.
        return;
      }

      oldReqsList = thisState.requirements[componentId] || [];
      oldReqsList.forEach((url) => {
        oldReqsObj[url] = true;
      });

      urls.forEach((url) => {
        if (url) {
          newReqsObj[url] = true;
        }
      });

      Object.keys(newReqsObj).forEach((url) => {
        newReqsList.push(url);
        // Decide whether to fetch this URL now.
        let ignoreExpiration;
        if (options && options.keepFresh) {
          // When keepFresh is specified, re-fetch the content
          // when it expires. Note that in order to keep the content
          // fresh, callers must still arrange to call this method on
          // user activity.
          ignoreExpiration = false;
        } else {
          // Otherwise, only refresh content when a newly mounted
          // component wants it. We do this by following this rule:
          // If the URL requirement was specified previously by this
          // component, load new objects, but don't reload expired objects.
          const isNew = !oldReqsObj[url];
          ignoreExpiration = !isNew;
        }
        if (this.shouldFetch(state, url, options, ignoreExpiration)) {
          toFetch[url] = true;
        }
      });
      newReqsList.sort();

      if (!arraysEqual(oldReqsList, newReqsList)) {
        // The requirements for the component have changed.
        dispatch({
          type: this.actionTypes.REQUIRE,
          payload: {
            componentId,
            requirements: newReqsList,
            options,
          },
        });
      }

      if (!thisState.suspended) {
        Object.keys(toFetch).forEach((url) => {
          dispatch(this.fetchNow(url, options));
        });
      }
    };
  }

  /**
   * get() returns the state of an object if available.  This should be used
   * in tandem with require().
   */
  get(state, url, defaultValue) {
    if (!url) {
      return defaultValue;
    }
    return state[this.reducerName].data[url] || defaultValue;
  }

  /**
   * Get the meta object for the given url.  May return null.
   * If the meta object has an error, return either null (the default)
   * or the meta object (if withError is true).
   */
  getMeta(state, url) {
    return state[this.reducerName].meta[url];
  }

  /**
   * Get the derived state from the given URL.
   * Return null if the state is not available or there is no derived state.
   */
  getDerived(state, url, name) {
    const meta = this.getMeta(state, url);
    return meta ? (meta.derived || null) : null;
  }

  /**
   * shouldFetch() returns true if the given object should be fetched.
   */
  shouldFetch(state, url, options, ignoreExpiration) {
    const meta = this.getMeta(state, url);
    if (!meta) {
      return true;
    }
    if (!ignoreExpiration) {
      // Check fetchExpires to prevent the dogpile effect.
      // https://www.sobstel.org/blog/preventing-dogpile-effect/
      if (!meta.fetchExpires || Date.now() >= meta.fetchExpires) {
        // Don't fetch unless the object is stale.
        if (!meta.expires || Date.now() >= meta.expires) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Return true if the specified object is currently being fetched.
   */
  fetching(state, url) {
    const meta = this.getMeta(state, url);
    if (!meta || !meta.fetchExpires) {
      return false;
    }
    return true;
  }

  /**
   * Return the error for an URL, if any.
   */
  getError(state, url) {
    const meta = this.getMeta(state, url);
    if (!meta) {
      return null;
    }
    return meta.error;
  }

  /**
   * fetchNow(), an action thunk creator, fetches an object unconditionally.
   */
  fetchNow = (url, options = {}) => (dispatch, getState) => {
    const fetchId = String(Date.now()) + '-' + String(Math.random());

    const isCurrent = () => {
      const meta = this.getMeta(getState(), url);
      if (!meta || meta.fetchId !== fetchId) {
        // A later call to fetchNow() has taken precedence.
        return false;
      }
      return true;
    };

    // Note: the request action is necessary. It signifies which fetch
    // operation is most current.
    dispatch({
      type: this.actionTypes.REQUEST,
      payload: {
        fetchId,
        url,
        options,
      },
    });

    const {
      /* Extract fetchcache-specific options from the fetch options. */
      /* eslint {"no-unused-vars": 0} */
      clear,
      keepFresh,
      fetcher,
      finalURL,
      useFinalURL,
      ...fetchOptions
    } = options;

    const fetchURL = finalURL && useFinalURL ? finalURL : url;

    let promise;
    if (fetcher) {
      // Add isCurrent to the options for the fetcher, then call the fetcher.
      const fetcherOptions = {
        ...fetchOptions,
        isCurrent,
      };
      promise = dispatch(fetcher.fetch(fetchURL, fetcherOptions));
    } else {
      // Fetch without the features of a fetcher (such as access token
      // refresh, error display, status code checking, etc.)
      promise = fetch(fetchURL, fetchOptions);
    }

    const actionTypes = this.actionTypes;
    return promise.then((body) => {
      dispatch({
        type: isCurrent() ? actionTypes.RECEIVE : actionTypes.RECEIVE_STALE,
        payload: {
          fetchId,
          url,
          body,
          options,
        },
      });

      if (finalURL && !useFinalURL) {
        // A final URL was provided and has not been used yet.
        // Now get the slower, final version of the data.
        dispatch(this.fetchNow(url, {
          ...options,
          useFinalURL: true,
        }));
      }
    }).catch((error) => {
      dispatch({
        type: isCurrent() ? actionTypes.ERROR : actionTypes.ERROR_STALE,
        error: true,
        payload: {
          fetchId,
          url,
          options,
          message: error,
        },
      });
    });
  };

  /**
   * Inject an object into the cache.
   */
  inject(url, body, options) {
    return {
      type: this.actionTypes.INJECT,
      payload: {
        url,
        body,
        options: (options || {}),
      },
    };
  }

  /**
   * Action creator: invalidate selected objects based on a 'keep' function.
   * The mounted components will request the objects again.
   */
  invalidate(keep) {
    return {
      type: this.actionTypes.INVALIDATE,
      payload: {
        keep,
      },
    };
  }

  /**
   * Action creator: clear the cache. Equivalent to invalidating everything.
   */
  clear() {
    return { type: this.actionTypes.CLEAR };
  }

  /**
   * Suspend accepting required URLs. We do this while
   * changing credentials to avoid making requests that would lead
   * to errors.
   */
  suspend() {
    return { type: this.actionTypes.SUSPEND };
  }

  /**
   * Resume accepting URLs.
   */
  resume() {
    return { type: this.actionTypes.RESUME };
  }

  makeActionHandlers() {
    const actionTypes = this.actionTypes;
    return {

      [actionTypes.REQUIRE]: (state, action) => {
        const {componentId, requirements} = action.payload;
        return {
          requirements: {
            ...state.requirements,
            [componentId]: requirements.length ? requirements : undefined,
          },
        };
      },

      [actionTypes.REQUEST]: (state, action) => {
        const {options, url, fetchId} = action.payload;
        const oldMeta = options.clear ? {} : (state.meta[url] || {});
        const fetchExpires = Date.now() + this.fetch_expires_ms;
        const newMeta = {
          ...oldMeta,
          fetchId,
          fetchExpires,
          options,
          derived: options.clear ? undefined : oldMeta.derived,
        };
        return {
          meta: {
            ...state.meta,
            [url]: newMeta,
          },
          data: {
            ...state.data,
            [url]: options.clear ? undefined : state.data[url],
          },
        };
      },

      [actionTypes.RECEIVE]: (state, action) => {
        const {options, url, body} = action.payload;
        const expires = Date.now() + this.expires_ms;
        const derived = (options.deriver ? options.deriver(body) : undefined);
        return {
          meta: {
            ...state.meta,
            [url]: {
              expires,
              options,
              derived,
            },
          },
          data: {
            ...state.data,
            [url]: body,
          },
        };
      },

      [actionTypes.INJECT]: (state, action) => {
        const {options, url, body} = action.payload;
        const expires = Date.now() + this.expires_ms;
        const oldObj = state.data[url];  // oldObj may be undefined.
        let newObj = body;
        if (options.condition) {
          // The condition option is a function that specifies whether
          // to actually inject the new state. The function receives
          // two parameters, the current state and the proposed state,
          // and returns true to inject or false to leave as-is.
          if (!options.condition(oldObj, newObj)) {
            // No change.
            return state;
          }
        }
        if (options.merge) {
          // Perform a shallow merge of the existing data with the updated
          // state object.
          newObj = {...(oldObj || {}), ...body};
        }
        const derived = (options.deriver ? options.deriver(newObj) : undefined);
        return {
          meta: {
            ...state.meta,
            [url]: {
              expires,
              options,
              derived,
            },
          },
          data: {
            ...state.data,
            [url]: newObj,
          },
        };
      },

      [actionTypes.ERROR]: (state, action) => {
        const {options, url, message} = action.payload;
        if (options.useFinalURL) {
          // Ignore errors when retrieving the final URL. The initial
          // URL worked so just leave well enough alone.
          return state;
        }
        const expires = Date.now() + this.error_expires_ms;
        return {
          meta: {
            ...state.meta,
            [url]: {
              error: String(message),
              expires,
              options,
            },
          },
        };
      },

      [actionTypes.INVALIDATE]: (state, action) => {
        const {keep} = action.payload;
        // Remove data and metadata that don't match the 'keep' function.
        const {data, meta} = state;
        const newData = {};
        Object.keys(meta).forEach((url) => {
          if (keep && keep(url)) {
            // Keep the data but re-fetch it in the background.
            newData[url] = data[url];
          }
        });
        return {data: newData, meta: {}};
      },

      [actionTypes.CLEAR]: () => ({
        // Remove all data and metadata from the state.
        data: {},
        meta: {},
      }),

      [actionTypes.SUSPEND]: () => ({suspended: true}),

      [actionTypes.RESUME]: () => ({suspended: false}),
    };
  }
}

// Export a default fetchcache implementation.
export const fetchcache = new FetchCache();

// Export a reducer for the default fetchcache implementation.
export default fetchcache.createReducer();
