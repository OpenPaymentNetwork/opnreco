
import { createReducer } from './common';

const OPEN_DRAWER = 'app/OPEN_DRAWER';
const CLOSE_DRAWER = 'app/CLOSE_DRAWER';
const TOGGLE_DRAWER = 'app/TOGGLE_DRAWER';
const SET_LAYOUT = 'app/SET_LAYOUT';
const SET_SYNC_PROGRESS = 'app/SET_SYNC_PROGRESS';
const SET_SERVER_ERROR = 'app/SET_SERVER_ERROR';

const initialState = {
  drawerOpen: false,
  layout: {},
  syncProgress: null,
  serverError: null,
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
};

export default createReducer(initialState, actionHandlers);
