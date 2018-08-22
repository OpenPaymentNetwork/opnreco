
import { createReducer, makeRandomUUID } from './common';

const LOG_OUT = 'login/LOG_OUT';
const LOG_IN = 'login/LOG_IN';
const SET_CAME_FROM = 'login/SET_CAME_FROM';
const START_OAUTH = 'login/START_OAUTH';
const CLEAR_OAUTH_STATE = 'login/CLEAR_OAUTH_STATE';

// Note: the login state is persistent, so only the small amount of state
// that should persist between sesssions should be stored here.
//
// 'token' is persistent so we remember who was logged in.
//
// 'personalName' is persistent so we can display the name of who was
// logged in when asking for the password to refresh the access token.
//
// 'oauthState' and 'cameFrom' are persistent so they can be recalled after
// OPN redirects to this app/site after successful OAuth.
//
// 'forceLogin', when true, indicates the user explicitly logged out
// and they should re-enter their web credentials at OPN.

const initialState = {
  token: '',
  personalName: '',  // Name of the logged in personal profile
  oauthState: '',
  cameFrom: '',
  forceLogin: false,
};

export const logOut = () => ({type: LOG_OUT});

export const logIn = (token, personalName) => ({
  type: LOG_IN,
  payload: {token, personalName},
});

export const setCameFrom = (pathName) => ({
  type: SET_CAME_FROM,
  payload: {pathName},
});

export const startOAuth = () => ({
  type: START_OAUTH,
  payload: {oauthState: makeRandomUUID()},
});

export const clearOAuthState = () => ({
  type: CLEAR_OAUTH_STATE,
});

const actionHandlers = {
  [LOG_OUT]: () => ({...initialState, forceLogin: true}),

  [LOG_IN]: (state, {payload: {token, personalName}}) => ({
    ...state,
    token,
    personalName,
    forceLogin: false,
  }),

  [SET_CAME_FROM]: (state, {payload: {pathName}}) => ({
    ...state,
    cameFrom: pathName,
  }),

  [START_OAUTH]: (state, {payload: {oauthState}}) => ({
    ...state,
    token: '',
    personalName: '',
    oauthState,
  }),

  [CLEAR_OAUTH_STATE]: (state) => ({
    ...state,
    oauthState: undefined,
  }),
};

export default createReducer(initialState, actionHandlers);
