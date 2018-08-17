
import { createReducer, makeRandomUUID } from './common';

export const LOG_OUT = 'login/LOG_OUT';
export const LOG_IN = 'login/LOG_IN';
export const SET_CAME_FROM = 'login/SET_CAME_FROM';
export const SET_OAUTH_STATE = 'login/SET_OAUTH_STATE';
export const CLEAR_OAUTH_STATE = 'login/CLEAR_OAUTH_STATE';

const initialState = {
  token: '',
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

const actionHandlers = {
  [LOG_OUT]: () => initialState,

  [LOG_IN]: (state, {payload: {token}}) => ({
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
};

export default createReducer(initialState, actionHandlers);
