
import { createReducer } from './common';

const SET_PLOOP_KEY = 'report/SET_PLOOP_KEY';
const SET_FILE_ID = 'report/SET_FILE_ID';
const SET_ROWS_PER_PAGE = 'report/SET_ROWS_PER_PAGE';
const SET_PAGE_INDEX = 'report/SET_PAGE_INDEX';

const initialState = {
  ploopKey: null,
  fileId: null,
  // rowsPerPage and pageIndex are for the Transactions report.
  rowsPerPage: 100,
  pageIndex: 0,
};

export const setPloopKey = (ploopKey) => ({
  type: SET_PLOOP_KEY, payload: {ploopKey}});

export const setFileId = (fileId) => ({
  type: SET_FILE_ID, payload: {fileId}});

export const setRowsPerPage = (rows) => ({
  type: SET_ROWS_PER_PAGE, payload: {rows}});

export const setPageIndex = (pageIndex) => ({
  type: SET_PAGE_INDEX, payload: {pageIndex}});

const actionHandlers = {
  [SET_PLOOP_KEY]: (state, {payload: {ploopKey}}) => ({
    ...state,
    ploopKey,
    fileId: null,
  }),

  [SET_FILE_ID]: (state, {payload: {fileId}}) => ({...state, fileId}),

  [SET_ROWS_PER_PAGE]: (state, {payload: {rows}}) => ({
    ...state,
    rowsPerPage: rows,
    pageIndex: 0,
  }),

  [SET_PAGE_INDEX]: (state, {payload: {pageIndex}}) => ({
    ...state,
    pageIndex,
  }),
};

export default createReducer(initialState, actionHandlers);
