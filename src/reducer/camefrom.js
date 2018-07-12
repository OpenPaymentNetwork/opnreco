
import createReducer from './common';

export const SETCAMEFROM = 'opnreport/SETCAMEFROM';

const initialState = '';

export const setCameFrom = (location) => ({
  type: SETCAMEFROM,
  payload: {location},
});

const actionHandlers = {
  [SETCAMEFROM]: (state, {payload: {location}}) => ({
    location,
  }),
};

export default createReducer(initialState, actionHandlers);
