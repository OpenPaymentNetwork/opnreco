
import { createReducer, makeRandomUUID } from './common';

const LOG_OUT = 'login/LOG_OUT';
const LOG_IN = 'login/LOG_IN';
const SET_CAME_FROM = 'login/SET_CAME_FROM';
const SET_OAUTH_STATE = 'login/SET_OAUTH_STATE';
const CLEAR_OAUTH_STATE = 'login/CLEAR_OAUTH_STATE';
const TOKEN_REFRESH_START = 'login/TOKEN_REFRESH_START';
const TOKEN_REFRESH_SUCCESS = 'login/TOKEN_REFRESH_SUCCESS';
const TOKEN_REFRESH_CANCEL = 'login/TOKEN_REFRESH_CANCEL';

const initialState = {
  token: '',
  tokenRefresh: false,
  deferreds: [],  // List of actions waiting for refresh: [{resolve, reject}]
};

export const logOut = () => ({type: LOG_OUT});

export const logIn = (token) => ({
  type: LOG_IN,
  payload: {token},
});

export const setCameFrom = (location) => ({
  type: SET_CAME_FROM,
  payload: {location},
});

export const setOAuthState = () => ({
  type: SET_OAUTH_STATE,
  payload: {oauthState: makeRandomUUID()},
});

export const clearOAuthState = () => ({
  type: CLEAR_OAUTH_STATE,
});

export const tokenRefreshStart = (deferred) => ({
  type: TOKEN_REFRESH_START,
  payload: {deferred},
});

export const tokenRefreshSuccess = (newToken) => (dispatch, getState) => {
  const deferreds = getState().tokenRefresh.deferreds;
  for (let i = 0; i < deferreds.length; i++) {
    const d = deferreds[i];
    if (d && d.resolve) {
      d.resolve(newToken);
    }
  }
  dispatch({type: TOKEN_REFRESH_SUCCESS});
};

export const tokenRefreshCancel = () => (dispatch, getState) => {
  const deferreds = getState().tokenRefresh.deferreds;
  for (let i = 0; i < deferreds.length; i++) {
    const d = deferreds[i];
    if (d && d.reject) {
      d.reject('cancel');
    }
  }
  dispatch({type: TOKEN_REFRESH_CANCEL});
};

const actionHandlers = {
  [LOG_OUT]: () => initialState,

  [LOG_IN]: (state, {payload: {token}}) => ({
    ...state,
    token,
  }),

  [SET_CAME_FROM]: (state, {payload: {location}}) => ({
    ...state,
    cameFrom: location.pathName,
  }),

  [SET_OAUTH_STATE]: (state, {payload: {oauthState}}) => ({
    ...state,
    oauthState,
  }),

  [CLEAR_OAUTH_STATE]: (state) => ({
    ...state,
    oauthState: undefined,
  }),

  [TOKEN_REFRESH_START]: (state, {payload: {deferred}}) => ({
    ...state,
    refresh: true,
    deferreds: [...(state.deferreds || []), deferred],
  }),

  [TOKEN_REFRESH_SUCCESS]: (state) => ({
    ...state,
    tokenRefresh: false,
    deferreds: [],
  }),

  [TOKEN_REFRESH_CANCEL]: (state) => ({
    ...state,
    tokenRefresh: false,
    deferreds: [],
  }),
};

export default createReducer(initialState, actionHandlers);
