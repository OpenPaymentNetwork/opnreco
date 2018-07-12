
import { combineReducers } from 'redux';
import deviceuuid from './deviceuuid';
import login from './login';
import camefrom from './camefrom';

export default combineReducers({
  camefrom,
  deviceuuid,
  login,
});
