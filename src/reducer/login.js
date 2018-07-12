
import createReducer from './common';

export const LOG_OUT = 'opnreport/LOG_OUT';
export const LOG_IN = 'opnreport/LOG_IN';

const initialState = {
  token: '',
};

export const logOut = () => ({type: LOG_OUT});

export const logIn = (token) => ({
  type: LOG_IN,
  payload: {token},
});

const actionHandlers = {
  [LOG_OUT]: () => initialState,
  [LOG_IN]: (state, {payload: {token}}) => ({
    token,
  }),
};

export default createReducer(initialState, actionHandlers);
