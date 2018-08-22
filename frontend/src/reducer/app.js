
import { createReducer } from './common';

const OPEN_DRAWER = 'app/OPEN_DRAWER';
const CLOSE_DRAWER = 'app/CLOSE_DRAWER';
const TOGGLE_DRAWER = 'app/TOGGLE_DRAWER';
const SET_LAYOUT = 'app/SET_LAYOUT';
const SET_SYNC_PROGRESS = 'app/SET_SYNC_PROGRESS';
const SET_SERVER_ERROR = 'app/SET_SERVER_ERROR';
const TOKEN_REFRESH_REQUEST = 'app/TOKEN_REFRESH_REQUEST';
const TOKEN_REFRESH_SUCCESS = 'app/TOKEN_REFRESH_SUCCESS';
const TOKEN_REFRESH_CANCEL = 'app/TOKEN_REFRESH_CANCEL';
const SET_LOGGING_OUT = 'app/SET_LOGGING_OUT';

const initialState = {
  drawerOpen: false,
  layout: {},
  syncProgress: null,
  serverError: null,
  tokenRefresh: false,
  // refreshDeferreds is a list of actions waiting for refresh:
  // [{resolve, reject}]
  refreshDeferreds: [],
  loggingOut: false,
};

export const openDrawer = () => ({type: OPEN_DRAWER});

export const closeDrawer = () => ({type: CLOSE_DRAWER});

export const toggleDrawer = () => ({type: TOGGLE_DRAWER});

export const setLayout = (layout) => ({type: SET_LAYOUT, payload: {layout}});

export const setSyncProgress = (progress) => ({
  type: SET_SYNC_PROGRESS,
  payload: {progress},
});

export const setServerError = (error) => ({
  type: SET_SERVER_ERROR,
  payload: {error},
});

export const tokenRefreshRequest = (deferred) => ({
  type: TOKEN_REFRESH_REQUEST,
  payload: {deferred},
});

export const tokenRefreshSuccess = (newToken) => (dispatch, getState) => {
  const refreshDeferreds = getState().app.refreshDeferreds;
  for (let i = 0; i < refreshDeferreds.length; i++) {
    const d = refreshDeferreds[i];
    if (d && d.resolve) {
      d.resolve(newToken);
    }
  }
  dispatch({type: TOKEN_REFRESH_SUCCESS});
};

export const tokenRefreshCancel = () => (dispatch, getState) => {
  const refreshDeferreds = getState().app.refreshDeferreds;
  for (let i = 0; i < refreshDeferreds.length; i++) {
    const d = refreshDeferreds[i];
    if (d && d.reject) {
      d.reject('cancel');
    }
  }
  dispatch({type: TOKEN_REFRESH_CANCEL});
};

export const setLoggingOut = (loggingOut) => ({
  type: SET_LOGGING_OUT,
  payload: {loggingOut},
});

const actionHandlers = {
  [OPEN_DRAWER]: (state) => ({...state, drawerOpen: true}),

  [CLOSE_DRAWER]: (state) => ({...state, drawerOpen: false}),

  [TOGGLE_DRAWER]: (state) => ({...state, drawerOpen: !state.drawerOpen}),

  [SET_LAYOUT]: (state, {payload: {layout}}) => ({...state, layout}),

  [SET_SYNC_PROGRESS]: (state, {payload: {progress}}) => ({
    ...state,
    syncProgress: progress,
  }),

  [SET_SERVER_ERROR]: (state, {payload: {error}}) => ({
    ...state,
    serverError: error,
  }),

  [TOKEN_REFRESH_REQUEST]: (state, {payload: {deferred}}) => ({
    ...state,
    tokenRefresh: true,
    refreshDeferreds: [...(state.refreshDeferreds || []), deferred],
  }),

  [TOKEN_REFRESH_SUCCESS]: (state) => ({
    ...state,
    tokenRefresh: false,
    refreshDeferreds: [],
  }),

  [TOKEN_REFRESH_CANCEL]: (state) => ({
    ...state,
    tokenRefresh: false,
    refreshDeferreds: [],
  }),

  [SET_LOGGING_OUT]: (state, {payload: {loggingOut}}) => ({
    ...state,
    loggingOut,
  }),
};

export default createReducer(initialState, actionHandlers);
