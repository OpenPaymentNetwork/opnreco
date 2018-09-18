
import { createReducer } from './common';

const SET_ACCOUNT_KEY = 'report/SET_ACCOUNT_KEY';
const SET_FILE_ID = 'report/SET_FILE_ID';

const initialState = {
  accountKey: null,
  fileId: null,
};

export const setAccountKey = (accountKey) => ({
  type: SET_ACCOUNT_KEY, payload: {accountKey}});

export const setFileId = (fileId) => ({
  type: SET_FILE_ID, payload: {fileId}});

const actionHandlers = {
  [SET_ACCOUNT_KEY]: (state, {payload: {accountKey}}) => ({
    ...state, accountKey}),
  [SET_FILE_ID]: (state, {payload: {fileId}}) => ({...state, fileId}),
};

export default createReducer(initialState, actionHandlers);
