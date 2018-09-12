import { fOPN } from '../util/fetcher';
import { fetchcache } from './fetchcache';


/** Clear most of the fetch cache except /token/selectable
 *  (which we'll re-fetch, but keep the data while waiting.)
 */
export function clearMost() {
  const selectableURL = fOPN.pathToURL('/token/selectable');
  const keep = (url) => (url === selectableURL);
  return fetchcache.invalidate(keep);
}
