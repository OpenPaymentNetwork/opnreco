
import { createReducer } from './common';

const SET_MIRROR_ID = 'report/SET_MIRROR_ID';
const SET_FILE_ID = 'report/SET_FILE_ID';

const initialState = {
  mirrorId: null,
  fileId: null,
};

export const setMirrorId = (mirrorId) => ({
  type: SET_MIRROR_ID, payload: {mirrorId}});

export const setFileId = (fileId) => ({
  type: SET_FILE_ID, payload: {fileId}});

const actionHandlers = {
  [SET_MIRROR_ID]: (state, {payload: {mirrorId}}) => ({...state, mirrorId}),

  [SET_FILE_ID]: (state, {payload: {fileId}}) => ({...state, fileId}),
};

export default createReducer(initialState, actionHandlers);
