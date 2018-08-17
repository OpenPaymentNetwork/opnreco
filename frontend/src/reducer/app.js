
import { createReducer } from './common';

export const OPEN_DRAWER = 'app/OPEN_DRAWER';
export const CLOSE_DRAWER = 'app/CLOSE_DRAWER';
export const TOGGLE_DRAWER = 'app/TOGGLE_DRAWER';
export const SET_LAYOUT = 'app/SET_LAYOUT';

const initialState = {
  drawerOpen: false,
  layout: {},
};

export const openDrawer = () => ({type: OPEN_DRAWER});

export const closeDrawer = () => ({type: CLOSE_DRAWER});

export const toggleDrawer = () => ({type: TOGGLE_DRAWER});

export const setLayout = (layout) => ({type: SET_LAYOUT, payload: layout});

const actionHandlers = {
  [OPEN_DRAWER]: (state) => ({...state, drawerOpen: true}),

  [CLOSE_DRAWER]: (state) => ({...state, drawerOpen: false}),

  [TOGGLE_DRAWER]: (state) => ({...state, drawerOpen: !state.drawerOpen}),

  [SET_LAYOUT]: (state, {payload}) => ({...state, layout: payload}),
};

export default createReducer(initialState, actionHandlers);
