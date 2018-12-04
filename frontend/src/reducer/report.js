
import { createReducer } from './common';

const SET_PLOOP_KEY = 'report/SET_PLOOP_KEY';
const SET_FILE_ID = 'report/SET_FILE_ID';

const initialState = {
  ploopKey: null,
  fileId: null,
};

export const setPloopKey = (ploopKey) => ({
  type: SET_PLOOP_KEY, payload: {ploopKey}});

export const setFileId = (fileId) => ({
  type: SET_FILE_ID, payload: {fileId}});

const actionHandlers = {
  [SET_PLOOP_KEY]: (state, {payload: {ploopKey}}) => ({
    ...state,
    ploopKey,
    fileId: null,
  }),

  [SET_FILE_ID]: (state, {payload: {fileId}}) => ({...state, fileId}),
};

export default createReducer(initialState, actionHandlers);
