
import { fetchcache } from '../reducer/fetchcache';
import { fOPNReport } from './fetcher';

const ploopsURL = fOPNReport.pathToURL('/ploops');


// Get the current ploop and file objects from the Redux state.
// They may be null.

export const getPloopAndFile = (state) => {

  const {ploopKey, fileId} = state.report;
  const fetched = fetchcache.get(state, ploopsURL) || {};
  const ploops = fetched.ploops || {};
  const ploopOrder = fetched.ploop_order;
  let selectedPloopKey = ploopKey;

  if (ploopOrder && ploopOrder.length) {
    if (!selectedPloopKey || !ploops[selectedPloopKey]) {
      selectedPloopKey = fetched.default_ploop || '';
    }

    if (!selectedPloopKey) {
      selectedPloopKey = ploopOrder[0];
    }
  } else {
    selectedPloopKey = '';
  }

  const ploop = selectedPloopKey ? ploops[selectedPloopKey] : null;

  let file = null;
  if (ploop && ploop.files) {
    if (fileId) {
      file = ploop.files[fileId];
    } else if (ploop.file_order && ploop.file_order.length) {
      file = ploop.files[ploop.file_order[0]];
    }
  }

  return {
    ploop,
    file,
  };
};
