
import { fetchcache } from '../reducer/fetchcache';
import { fOPNReco } from './fetcher';

const ploopsURL = fOPNReco.pathToURL('/ploops');


// Get the current ploop and period objects from the Redux state.
// They may be null.

export const getPloopAndPeriod = (state) => {

  const {ploopKey, periodId} = state.report;
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

  let period = null;
  if (ploop && ploop.periods) {
    if (periodId) {
      period = ploop.periods[periodId];
    } else if (ploop.period_order && ploop.period_order.length) {
      period = ploop.periods[ploop.period_order[0]];
    }
  }

  return {
    ploop,
    period,
  };
};
