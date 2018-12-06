
import { fOPN, fOPNReco } from '../util/fetcher';
import { fetchcache } from './fetchcache';


/**
 * Clear most of the fetch cache except /token/selectable and /ploops
 *  (which we'll re-fetch, but keep the data while waiting.)
 */
export function clearMost() {
  const selectableURL = fOPN.pathToURL('/token/selectable');
  const ploopsURL = fOPNReco.pathToURL('/ploops');
  const keep = (url) => (url === selectableURL || url === ploopsURL);
  return fetchcache.invalidate(keep);
}

/**
 * Keep everything but re-fetch it all when required.
 */
export function refetchAll() {
  return fetchcache.invalidate(() => true);
}
