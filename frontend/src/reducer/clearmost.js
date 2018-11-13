
import { fOPN, fOPNReport } from '../util/fetcher';
import { fetchcache } from './fetchcache';


/**
 * Clear most of the fetch cache except /token/selectable
 *  (which we'll re-fetch, but keep the data while waiting.)
 */
export function clearMost() {
  const selectableURL = fOPN.pathToURL('/token/selectable');
  const keep = (url) => (url === selectableURL);
  return fetchcache.invalidate(keep);
}

/**
 * Keep everything but re-fetch it all when required.
 */
export function refetchAll() {
  return fetchcache.invalidate(() => true);
}

/**
 * Clear most of the fetch cache except /token/selectable,
 * the peer loops, and any recos. (This avoids chaos while
 * closing the dialog.) Everything will be fetched in the background.
 */
export function clearOnSaveReco() {
  const keepBases = [
    fOPN.pathToURL('/token/selectable'),
    fOPNReport.pathToURL('/ploops'),
    fOPNReport.pathToURL('/reco'),
  ];

  const keep = url => {
    let keep = false;
    keepBases.forEach(base => {
      if (url.startsWith(base)) {
        keep = true;
      }
    });
    return keep;
  };
  return fetchcache.invalidate(keep);
}
