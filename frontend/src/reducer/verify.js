
import { createReducer } from './common';

const VERIFY_SHOW_DETAILS = 'verify/SHOW_DETAILS';

const initialState = {};

export const verifyShowDetails = (verification_id, batch_count) => ({
  type: VERIFY_SHOW_DETAILS, payload: {verification_id, batch_count}});

const actionHandlers = {
  [VERIFY_SHOW_DETAILS]: (state, {payload: {verification_id, batch_count}}) => {
    return {
      verification_id,
      batch_count,
    };
  },
};

export default createReducer(initialState, actionHandlers);
