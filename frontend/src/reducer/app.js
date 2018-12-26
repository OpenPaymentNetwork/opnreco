
import { createReducer } from './common';

const OPEN_DRAWER = 'app/OPEN_DRAWER';
const CLOSE_DRAWER = 'app/CLOSE_DRAWER';
const TOGGLE_DRAWER = 'app/TOGGLE_DRAWER';
const SET_LAYOUT = 'app/SET_LAYOUT';
const SET_SYNC_PROGRESS = 'app/SET_SYNC_PROGRESS';
const TRIGGER_RESYNC = 'app/TRIGGER_RESYNC';
const SET_SERVER_ERROR = 'app/SET_SERVER_ERROR';
const CLOSE_SERVER_ERROR = 'app/CLOSE_SERVER_ERROR';
const TOKEN_REFRESH_REQUEST = 'app/TOKEN_REFRESH_REQUEST';
const TOKEN_REFRESH_SUCCESS = 'app/TOKEN_REFRESH_SUCCESS';
const TOKEN_REFRESH_CANCEL = 'app/TOKEN_REFRESH_CANCEL';
const SET_LOGGING_OUT = 'app/SET_LOGGING_OUT';
const SET_TRANSFER_ID = 'app/SET_TRANSFER_ID';
const SET_STATEMENT_ID = 'app/SET_STATEMENT_ID';

const initialState = {
  // [{resolve, reject}]
  // refreshDeferreds is a list of actions waiting for token refresh:
  drawerOpen: false,
  layout: {},
  loggingOut: false,
  refreshDeferreds: [],
  serverError: null,
  serverErrorOpen: false,
  statementId: null,
  statementPeriodId: null,
  syncedAt: null,
  syncProgress: null,
  tokenRefresh: false,
  transferId: null,
};

export const openDrawer = () => ({type: OPEN_DRAWER});

export const closeDrawer = () => ({type: CLOSE_DRAWER});

export const toggleDrawer = () => ({type: TOGGLE_DRAWER});

export const setLayout = (layout) => ({type: SET_LAYOUT, payload: {layout}});

export const setSyncProgress = (progress, syncedAt) => ({
  type: SET_SYNC_PROGRESS,
  payload: {progress, syncedAt},
});

export const triggerResync = () => ({type: TRIGGER_RESYNC});

export const setServerError = (error) => ({
  type: SET_SERVER_ERROR,
  payload: {error: error ? String(error) : null},
});

export const closeServerError = () => ({type: CLOSE_SERVER_ERROR});

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

export const setTransferId = (transferId) => ({
  type: SET_TRANSFER_ID,
  payload: {transferId},
});

export const setStatementId = (statementId, statementPeriodId) => ({
  type: SET_STATEMENT_ID,
  payload: {statementId, statementPeriodId},
});

const actionHandlers = {
  [OPEN_DRAWER]: (state) => ({...state, drawerOpen: true}),

  [CLOSE_DRAWER]: (state) => ({...state, drawerOpen: false}),

  [TOGGLE_DRAWER]: (state) => ({...state, drawerOpen: !state.drawerOpen}),

  [SET_LAYOUT]: (state, {payload: {layout}}) => ({...state, layout}),

  [SET_SYNC_PROGRESS]: (state, {payload: {progress, syncedAt}}) => ({
    ...state,
    syncProgress: progress,
    syncedAt: syncedAt || state.syncedAt,
  }),

  [TRIGGER_RESYNC]: (state) => ({
    ...state,
    syncProgress: null,
    syncedAt: null,
  }),

  [SET_SERVER_ERROR]: (state, {payload: {error}}) => ({
    ...state,
    serverError: error,
    serverErrorOpen: true,
  }),

  [CLOSE_SERVER_ERROR]: (state) => ({
    ...state,
    serverErrorOpen: false,
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

  [SET_TRANSFER_ID]: (state, {payload: {transferId}}) => ({
    ...state,
    transferId,
  }),

  [SET_STATEMENT_ID]: (state, {payload: {
      statementId, statementPeriodId}}) => ({
    ...state,
    statementId,
    statementPeriodId,
  }),
};

export default createReducer(initialState, actionHandlers);
