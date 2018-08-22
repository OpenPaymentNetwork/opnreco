
/* global process: false */

import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { startOAuth } from '../../reducer/login';


class LoginView extends React.Component {

  static propTypes = {
    deviceUUID: PropTypes.string,
    forceLogin: PropTypes.bool,
    oauthState: PropTypes.string,
    startOAuth: PropTypes.func.isRequired,
  };

  componentDidMount() {
    this.props.startOAuth();
  }

  render() {
    const {deviceUUID, oauthState, forceLogin} = this.props;

    if (!deviceUUID || !oauthState) {
      // The random strings haven't been generated yet.
      return <div>Preparing to log in...</div>;
    }

    const url = (
      process.env.REACT_APP_OPN_PUBLIC_URL +
      '/authorize?client_id=' +
      encodeURIComponent(process.env.REACT_APP_OPN_CLIENT_ID) +
      '&response_type=token' +
      '&redirect_uri=' +
      process.env.REACT_APP_URL + '/oauth2cb' +
      '&scope=' +
      encodeURIComponent(
        'mobile_device select_profile view_wallet ' +
        'view_history view_full_history') +
      '&name=OPNReport' +
      '&uuid=' +
      encodeURIComponent(deviceUUID) +
      '&state=' +
      encodeURIComponent(oauthState) +
      '&force_login=' +
      (forceLogin ? 'true' : 'false'));

    return (
      <p>
        <a href={url}>Sign In</a>
      </p>
    );
  }
}

function mapStateToProps(state) {
  return {
    deviceUUID: state.deviceuuid,
    oauthState: state.login.oauthState,
    forceLogin: state.login.forceLogin,
  };
}

const dispatchToProps = {
  startOAuth,
};

export default connect(mapStateToProps, dispatchToProps)(LoginView);
