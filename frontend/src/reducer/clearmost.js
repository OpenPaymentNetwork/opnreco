
import { filesURL, selectableURL, settingsURL } from '../util/fetcher';
import { fetchcache } from './fetchcache';


/**
 * Clear most of the fetch cache except /token/selectable and /files
 * (which we'll re-fetch, but keep the data while waiting.)
 */
export function clearMost() {
  const keep = (url) => (
    url === selectableURL || (url && url.startsWith(filesURL)));
  return fetchcache.invalidate(keep);
}

/**
 * Clear most of the fetch cache except /token/selectable.
 * The files URL must be cleared.
 */
export function clearWithFiles() {
  const keep = (url) => (url === selectableURL);
  return fetchcache.invalidate(keep);
}

/**
 * Clear most of the fetch cache except /token/selectable and /settings.
 * /files must be cleared.
 */
export function clearForSettings() {
  const keep = (url) => (url === selectableURL || url === settingsURL);
  return fetchcache.invalidate(keep);
}

/**
 * Keep everything but re-fetch it all when required.
 */
export function refetchAll() {
  return fetchcache.invalidate(() => true);
}
