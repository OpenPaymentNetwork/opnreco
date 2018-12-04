
import { createReducer } from './common';

const SET_ROWS_PER_PAGE = 'pager/SET_ROWS_PER_PAGE';
const SET_PAGE_INDEX = 'pager/SET_PAGE_INDEX';

const initialState = {};  // pagerName: {rowsPerPage, pageIndex}

export const setRowsPerPage = (pagerName, rowsPerPage) => ({
  type: SET_ROWS_PER_PAGE, meta: {pagerName}, payload: {rowsPerPage}});

export const setPageIndex = (pagerName, pageIndex) => ({
  type: SET_PAGE_INDEX, meta: {pagerName}, payload: {pageIndex}});

const actionHandlers = {
  [SET_ROWS_PER_PAGE]: (state, {meta: {pagerName}, payload: {rowsPerPage}}) => ({
    ...state,
    [pagerName]: {
      rowsPerPage,
      pageIndex: 0,
    }
  }),

  [SET_PAGE_INDEX]: (state, {meta: {pagerName}, payload: {pageIndex}}) => ({
    ...state,
    [pagerName]: {
      ...state[pagerName],
      pageIndex,
    },
  }),
};

export const getPagerState = (state, pagerName, initialRowsPerPage=100) => {
  const pagerState = state.pager[pagerName] || {};
  return {
    rowsPerPage: pagerState.rowsPerPage || initialRowsPerPage,
    pageIndex: pagerState.pageIndex || 0,
    initialRowsPerPage,
  };
};

export default createReducer(initialState, actionHandlers);
