
import { createReducer, makeRandomUUID } from './common';

export const SET_CAME_FROM = 'oauth/SET_CAME_FROM';
export const SET_STATE_TOKEN = 'oauth/SET_STATE_TOKEN';
export const CLEAR_STATE_TOKEN = 'oauth/CLEAR_STATE_TOKEN';

const initialState = {};

export const setCameFrom = (location) => ({
  type: SET_CAME_FROM,
  payload: {location},
});

export const setStateToken = () => ({
  type: SET_STATE_TOKEN,
  payload: {stateToken: makeRandomUUID()},
});

export const clearStateToken = () => ({
  type: CLEAR_STATE_TOKEN,
});

const actionHandlers = {
  [SET_CAME_FROM]: (state, {payload: {location}}) => ({
    ...state,
    cameFrom: location.pathName,
  }),

  [SET_STATE_TOKEN]: (state, {payload: {stateToken}}) => ({
    ...state,
    stateToken,
  }),

  [CLEAR_STATE_TOKEN]: (state) => ({
    ...state,
    stateToken: undefined,
  }),
};

export default createReducer(initialState, actionHandlers);
