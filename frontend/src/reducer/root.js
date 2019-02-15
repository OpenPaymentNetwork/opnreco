import { combineReducers } from 'redux';
import app from './app';
import deviceuuid from './deviceuuid';
import fetchcache from './fetchcache';
import login from './login';
import pager from './pager';
import tree from './tree';
import verify from './verify';

export default combineReducers({
  app,
  deviceuuid,
  login,
  fetchcache,
  pager,
  tree,
  verify,
});
