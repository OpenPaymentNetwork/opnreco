
import { createReducer } from './common';

export const OPEN_DRAWER = 'app/OPEN_DRAWER';
export const CLOSE_DRAWER = 'app/CLOSE_DRAWER';
export const TOGGLE_DRAWER = 'app/TOGGLE_DRAWER';
export const SET_LAYOUT = 'app/SET_LAYOUT';
export const SET_SYNC_PROGRESS = 'app/SET_SYNC_PROGRESS';

const initialState = {
  drawerOpen: false,
  layout: {},
  syncProgress: null,
};

export const openDrawer = () => ({type: OPEN_DRAWER});

export const closeDrawer = () => ({type: CLOSE_DRAWER});

export const toggleDrawer = () => ({type: TOGGLE_DRAWER});

export const setLayout = (layout) => ({type: SET_LAYOUT, payload: layout});

export const setSyncProgress = (progress) => ({
  type: SET_SYNC_PROGRESS,
  payload: progress,
});

const actionHandlers = {
  [OPEN_DRAWER]: (state) => ({...state, drawerOpen: true}),

  [CLOSE_DRAWER]: (state) => ({...state, drawerOpen: false}),

  [TOGGLE_DRAWER]: (state) => ({...state, drawerOpen: !state.drawerOpen}),

  [SET_LAYOUT]: (state, {payload}) => ({...state, layout: payload}),

  [SET_SYNC_PROGRESS]: (state, {payload}) => ({
    ...state,
    syncProgress: payload,
  }),
};

export default createReducer(initialState, actionHandlers);
