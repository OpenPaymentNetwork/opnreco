
// Redux reducer for fetching info from URLs and caching the results.

const FETCHCACHE_CLEAR = 'fetchcache/CLEAR';
const FETCHCACHE_ERROR = 'fetchcache/ERROR';
const FETCHCACHE_ERROR_STALE = 'fetchcache/ERROR_STALE';
const FETCHCACHE_INJECT = 'fetchcache/INJECT';
const FETCHCACHE_INVALIDATE = 'fetchcache/INVALIDATE';
const FETCHCACHE_RECEIVE = 'fetchcache/RECEIVE';
const FETCHCACHE_RECEIVE_STALE = 'fetchcache/RECEIVE_STALE';
const FETCHCACHE_REQUEST = 'fetchcache/REQUEST';
const FETCHCACHE_REQUIRE = 'fetchcache/REQUIRE';
const FETCHCACHE_RESUME = 'fetchcache/RESUME';
const FETCHCACHE_SUSPEND = 'fetchcache/SUSPEND';


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

  constructor(reducerName, config = {}) {
    this.reducerName = reducerName;
    this.error_expires_ms = config.error_expires_ms || 5 * 1000;  // 5 seconds
    this.expires_ms = config.expires_ms || 30 * 1000;             // 30 seconds
    this.fetch_expires_ms = config.fetch_expires_ms || 5 * 1000;  // 5 seconds
  }

  /**
   * Create and return the reducer for this FetchCache. The resulting
   * reducer ignores actions intended for FetchCaches with a different
   * reducerName.
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
      if (!reduceFn || !action.meta ||
          action.meta.reducerName !== this.reducerName) {
        return state;
      }
      return {...state, ...reduceFn(state, action)};
    };
  }

  /**
   * require(), an action thunk creator,
   * registers component requirements and causes objects to be fetched.
   */
  require(componentId, fetcher, urls, options = {}) {
    return (dispatch, getState) => {
      const state = getState();
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
        }
      });
      newReqsList.sort();

      if (!arraysEqual(oldReqsList, newReqsList)) {
        // The requirements for the component have changed.
        dispatch({
          type: FETCHCACHE_REQUIRE,
          meta: {
            reducerName: this.reducerName,
          },
          payload: {
            componentId,
            requirements: newReqsList,
            options,
          },
        });
      }

      if (!thisState.suspended) {
        Object.keys(toFetch).forEach((url) => {
          dispatch(this.fetchNow(fetcher, url, options));
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
  fetchNow = (fetcher, url, options = {}) => (dispatch, getState) => {
    const fetchId = String(Date.now()) + '-' + String(Math.random());

    const reducerName = this.reducerName;

    const isCurrent = () => {
      const meta = this.getMeta(getState(), url);
      if (!meta || meta.fetchId !== fetchId) {
        // A later call to fetchNow() has taken precedence.
        return false;
      }
      return true;
    };

    const fOptions = {
      ...options.fetchOptions || {},
      isCurrent,
    };

    // Note: the request action is necessary. It signifies which fetch
    // operation is most current.
    dispatch({
      type: FETCHCACHE_REQUEST,
      meta: {
        reducerName,
      },
      payload: {
        fetchId,
        fetcher,
        url,
        options,
        fOptions,
      },
    });

    return dispatch(fetcher.fetchURL(url, fOptions)).then((body) => {
      dispatch({
        type: isCurrent() ? FETCHCACHE_RECEIVE : FETCHCACHE_RECEIVE_STALE,
        meta: {
          reducerName,
        },
        payload: {
          fetchId,
          url,
          body,
          options,
        },
      });
    }).catch((error) => {
      dispatch({
        type: isCurrent() ? FETCHCACHE_ERROR : FETCHCACHE_ERROR_STALE,
        error: true,
        meta: {
          reducerName,
        },
        payload: {
          fetchId,
          url,
          fOptions,
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
      type: FETCHCACHE_INJECT,
      meta: {
        reducerName: this.reducerName,
      },
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
      type: FETCHCACHE_INVALIDATE,
      meta: {
        reducerName: this.reducerName,
      },
      payload: {
        keep,
      },
    };
  }

  /**
   * Action creator: clear the cache.
   */
  clear() {
    return {
      type: FETCHCACHE_CLEAR,
      meta: {
        reducerName: this.reducerName,
      },
    };
  }

  /**
   * Suspend accepting required URLs. We do this while
   * changing credentials to avoid making requests that would lead
   * to errors.
   */
  suspend() {
    return {
      type: FETCHCACHE_SUSPEND,
      meta: {
        reducerName: this.reducerName,
      },
    };
  }

  /**
   * Resume accepting URLs.
   */
  resume() {
    return {
      type: FETCHCACHE_RESUME,
      meta: {
        reducerName: this.reducerName,
      },
    };
  }

  makeActionHandlers = () => ({

    [FETCHCACHE_REQUIRE]: (state, action) => {
      const {componentId, requirements} = action.payload;
      return {
        requirements: {
          ...state.requirements,
          [componentId]: requirements.length ? requirements : undefined,
        },
      };
    },

    [FETCHCACHE_REQUEST]: (state, action) => {
      const {options, url, fetchId} = action.payload;
      const oldMeta = options.clear ? {} : (state.meta[url] || {});
      const fetchExpires = Date.now() + this.fetch_expires_ms;
      const newMeta = {
        ...oldMeta,
        fetchId,
        fetchExpires,
        options,
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

    [FETCHCACHE_RECEIVE]: (state, action) => {
      const {options, url, body} = action.payload;
      const expires = Date.now() + this.expires_ms;
      return {
        meta: {
          ...state.meta,
          [url]: {
            expires,
            options,
          },
        },
        data: {
          ...state.data,
          [url]: body,
        },
      };
    },

    [FETCHCACHE_INJECT]: (state, action) => {
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
      return {
        meta: {
          ...state.meta,
          [url]: {
            expires,
            options,
          },
        },
        data: {
          ...state.data,
          [url]: newObj,
        },
      };
    },

    [FETCHCACHE_ERROR]: (state, action) => {
      const {options, url, message} = action.payload;
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

    [FETCHCACHE_INVALIDATE]: (state, action) => {
      const {keep} = action.payload;
      // Remove data and metadata that don't match the 'keep' function.
      const {data, meta} = state;
      const newData = {};
      const newMeta = {};
      Object.keys(meta).forEach((key) => {
        if (keep && keep(key)) {
          newMeta[key] = meta[key];
          newData[key] = data[key];
        }
      });
      return {data: newData, meta: newMeta};
    },

    [FETCHCACHE_CLEAR]: () => ({
      // Remove all data and metadata from the state.
      data: {},
      meta: {},
    }),

    [FETCHCACHE_SUSPEND]: () => ({suspended: true}),

    [FETCHCACHE_RESUME]: () => ({suspended: false}),

  });
}


export const fetchcache = new FetchCache('fetchcache');

export default fetchcache.createReducer();
