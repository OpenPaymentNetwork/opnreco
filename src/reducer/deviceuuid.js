
import { makeRandomUUID } from './common';

export default function reducer(state = null) {
  return state || makeRandomUUID();
}
