
import { combineReducers } from 'redux';
import deviceuuid from './deviceuuid';
import login from './login';
import oauth from './oauth';

export default combineReducers({
  oauth,
  deviceuuid,
  login,
});
