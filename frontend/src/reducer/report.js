
import { createReducer } from './common';

const SET_MIRROR_ID = 'report/SET_MIRROR_ID';
const SET_DATE_RANGE = 'report/SET_DATE_RANGE';
const SET_START_DATE = 'report/SET_START_DATE';
const SET_END_DATE = 'report/SET_END_DATE';

const initialState = {
  mirrorId: null,
  startDate: null,
  endDate: null,
};

export const setMirrorID = (mirrorId) => ({
  type: SET_MIRROR_ID, payload: {mirrorId}});

export const setDateRange = (startDate, endDate) => ({
  type: SET_DATE_RANGE, payload: {startDate, endDate}});

export const setStartDate = (startDate) => ({
  type: SET_START_DATE, payload: {startDate}});

export const setEndDate = (endDate) => ({
  type: SET_END_DATE, payload: {endDate}});

const actionHandlers = {
  [SET_MIRROR_ID]: (state, {payload: {mirrorId}}) => ({...state, mirrorId}),

  [SET_DATE_RANGE]: (state, {payload: {startDate, endDate}}) => ({
    ...state,
    startDate,
    endDate,
  }),

  [SET_START_DATE]: (state, {payload: {startDate}}) => ({
    ...state,
    startDate,
  }),

  [SET_END_DATE]: (state, {payload: {endDate}}) => ({
    ...state,
    endDate,
  }),
};

export default createReducer(initialState, actionHandlers);
