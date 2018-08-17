
/* global process: false */

import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { setOAuthState } from '../../reducer/login';


class LoginView extends React.Component {

  componentDidMount() {
    this.props.setOAuthState();
  }

  render() {
    if (!this.props.deviceUUID || !this.props.oauthState) {
      return <div>Setting up login...</div>;
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
      encodeURIComponent(this.props.deviceUUID) +
      '&state=' +
      encodeURIComponent(this.props.oauthState));

    return (
      <p>
        <a href={url}>Log in</a>
      </p>
    );
  }
}

LoginView.propTypes = {
  setOAuthState: PropTypes.func.isRequired,
  deviceUUID: PropTypes.string,
  oauthState: PropTypes.string,
};

function mapStateToProps(state) {
  return {
    deviceUUID: state.deviceuuid,
    oauthState: state.login.oauthState,
  };
}

const dispatchToProps = {
  setOAuthState,
};

export default connect(mapStateToProps, dispatchToProps)(LoginView);
