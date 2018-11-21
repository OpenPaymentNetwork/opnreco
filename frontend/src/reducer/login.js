
import { createReducer, makeRandomUUID } from './common';

const LOG_OUT = 'login/LOG_OUT';
const LOG_IN = 'login/LOG_IN';
const SET_CAME_FROM = 'login/SET_CAME_FROM';
const START_OAUTH = 'login/START_OAUTH';
const CLEAR_OAUTH_STATE = 'login/CLEAR_OAUTH_STATE';
const SWITCH_PROFILE = 'login/SWITCH_PROFILE';

const ACCESS_TOKEN_KEY = 'opnreport:access_tokens';

// Note: the login state is persistent, so only the small amount of state
// that should persist between sesssions should be stored here.
//
// 'token' is persistent so we remember who was logged in.
//
// 'personalProfile' is persistent so we can display the name of who was
// logged in when asking for the password to refresh the access token.
//
// 'oauthState' and 'cameFrom' are persistent so they can be recalled after
// OPN redirects to this app/site after successful OAuth.
//
// 'forceLogin', when true, indicates the user explicitly logged out
// and they should re-enter their web credentials at OPN.

const initialState = {
  authenticated: false,
  id: '',  // id of the selected profile (may be diff from personal profile)
  personalProfile: {},  // id and title of the logged in personal profile
  oauthState: '',
  cameFrom: '',
  forceLogin: false,
};

export const logOut = () => ({type: LOG_OUT});

export const logIn = (token, personalProfile) => {
  if (personalProfile && personalProfile.id) {
    setAccessToken(personalProfile.id, token);
  }
  return {
    type: LOG_IN,
    payload: {personalProfile},
  };
};

export const setCameFrom = (pathName) => ({
  type: SET_CAME_FROM,
  payload: {pathName},
});

export const startOAuth = () => {
  clearAccessTokens();
  return {
    type: START_OAUTH,
    payload: {oauthState: makeRandomUUID()},
  };
};

export const clearOAuthState = () => ({
  type: CLEAR_OAUTH_STATE,
});

export const switchProfile = (token, id) => {
  setAccessToken(id, token);
  return {
    type: SWITCH_PROFILE,
    payload: {id},
  };
};

export const clearAccessTokens = () => {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
};

export const getAccessToken = (profileId) => {
  const mapStr = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  if (mapStr) {
    let mapObj;
    try {
      mapObj = JSON.parse(mapStr);
    } catch (e) {
      return null;
    }
    if (mapObj) {
      return mapObj[profileId];
    }
  }
  return null;
};

export const setAccessToken = (profileId, token) => {
  const mapStr = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  let mapObj = {};
  if (mapStr) {
    try {
      mapObj = JSON.parse(mapStr);
    } catch (e) {
      // ignore
    }
  }
  mapObj[profileId] = token;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, JSON.stringify(mapObj));
};

const actionHandlers = {
  [LOG_OUT]: () => ({...initialState, forceLogin: true}),

  [LOG_IN]: (state, {payload: {personalProfile}}) => ({
    ...state,
    authenticated: true,
    id: personalProfile ? personalProfile.id : '',
    personalProfile,
    forceLogin: false,
  }),

  [SET_CAME_FROM]: (state, {payload: {pathName}}) => ({
    ...state,
    cameFrom: pathName,
  }),

  [START_OAUTH]: (state, {payload: {oauthState}}) => ({
    ...state,
    authenticated: false,
    id: '',
    personalProfile: {},
    oauthState,
  }),

  [CLEAR_OAUTH_STATE]: (state) => ({
    ...state,
    oauthState: undefined,
  }),

  [SWITCH_PROFILE]: (state, {payload: {id}}) => ({
    ...state,
    id,
  }),
};

export default createReducer(initialState, actionHandlers);
