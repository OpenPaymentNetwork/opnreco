
import { createReducer } from './common';

const SET_PLOOP_KEY = 'report/SET_PLOOP_KEY';
const SET_FILE_ID = 'report/SET_FILE_ID';
const SET_ROWS_PER_PAGE = 'report/SET_ROWS_PER_PAGE';
const SET_PAGE_INDEX = 'report/SET_PAGE_INDEX';
const SHOW_RECO_POPOVER = 'report/SHOW_RECO_POPOVER';
const CLOSE_RECO_POPOVER = 'report/CLOSE_RECO_POPOVER';

const initialState = {
  ploopKey: null,
  fileId: null,
  // rowsPerPage and pageIndex are for the Transactions report.
  rowsPerPage: 100,  // May be null
  pageIndex: 0,
  recoPopover: {},
};

export const setPloopKey = (ploopKey) => ({
  type: SET_PLOOP_KEY, payload: {ploopKey}});

export const setFileId = (fileId) => ({
  type: SET_FILE_ID, payload: {fileId}});

export const setRowsPerPage = (rows) => ({
  type: SET_ROWS_PER_PAGE, payload: {rows}});

export const setPageIndex = (pageIndex) => ({
  type: SET_PAGE_INDEX, payload: {pageIndex}});

export const showRecoPopover = (payload) => ({
  type: SHOW_RECO_POPOVER, payload});

export const closeRecoPopover = () => ({type: CLOSE_RECO_POPOVER});

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

  [SHOW_RECO_POPOVER]:
  (state, {payload: {movementId, recoId, recoInternal, anchorEl}}) => ({
    ...state,
    recoPopover: {
      open: true,
      movementId,
      recoId,
      recoInternal,
      anchorEl,
    },
  }),

  [CLOSE_RECO_POPOVER]: (state) => ({
    ...state,
    recoPopover: {
      // Keep the rest of the attrs so the popover doesn't get garbled while
      // fading.
      ...state.recoPopover,
      open: false,
    },
  }),
};

export default createReducer(initialState, actionHandlers);
