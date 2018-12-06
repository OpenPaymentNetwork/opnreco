
import { createReducer } from './common';

const SET_PLOOP_KEY = 'report/SET_PLOOP_KEY';
const SET_PERIOD_ID = 'report/SET_PERIOD_ID';

const initialState = {
  ploopKey: null,
  periodId: null,
};

export const setPloopKey = (ploopKey) => ({
  type: SET_PLOOP_KEY, payload: {ploopKey}});

export const setPeriodId = (periodId) => ({
  type: SET_PERIOD_ID, payload: {periodId}});

const actionHandlers = {
  [SET_PLOOP_KEY]: (state, {payload: {ploopKey}}) => ({
    ...state,
    ploopKey,
    periodId: null,
  }),

  [SET_PERIOD_ID]: (state, {payload: {periodId}}) => ({...state, periodId}),
};

export default createReducer(initialState, actionHandlers);
