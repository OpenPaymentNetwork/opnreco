
/* global process: false */

import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { startOAuth } from '../../reducer/login';
import { withStyles } from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import React from 'react';
import Typography from '@material-ui/core/Typography';


const styles = (theme) => ({
  root: {
    height: '100%',
  },
  bannerBox: {
    marginTop: '160px',
    textAlign: 'center',
  },
  banner: {
    color: theme.palette.primary.main,
    paddingBottom: '16px',
  },
  serviceLine: {
    paddingTop: '16px',
  },
});


class LoginView extends React.Component {

  static propTypes = {
    classes: PropTypes.object.isRequired,
    deviceUUID: PropTypes.string,
    forceLogin: PropTypes.bool,
    oauthState: PropTypes.string,
    dispatch: PropTypes.func.isRequired,
  };

  componentDidMount() {
    this.startOAuth();
  }

  componentDidUpdate() {
    if (!this.props.oauthState) {
      // componentDidMount() should normally call startOAuth(), but
      // sometimes after logout it doesn't work. Just fix it. :-)
      this.startOAuth();
    }
  }

  startOAuth() {
    this.props.dispatch(startOAuth());
  }

  render() {
    const {deviceUUID, oauthState, forceLogin, classes} = this.props;

    if (!deviceUUID || !oauthState) {
      // The random strings haven't been generated yet.
      return <div style={{opacity: '0.1'}}>Loading&hellip;</div>;
    }

    const platformURL = process.env.REACT_APP_OPN_PUBLIC_URL;

    const url = (
      platformURL +
      '/authorize?client_id=' +
      encodeURIComponent(process.env.REACT_APP_OPN_CLIENT_ID) +
      '&response_type=token' +
      '&redirect_uri=' +
      encodeURIComponent(process.env.REACT_APP_URL + '/oauth2cb') +
      '&scope=' +
      encodeURIComponent(
        'mobile_device select_profile view_wallet ' +
        'view_history view_full_history') +
      '&name=' + encodeURIComponent('OPN Reconciliation') +
      '&uuid=' + encodeURIComponent(deviceUUID) +
      '&state=' + encodeURIComponent(oauthState) +
      (forceLogin ? '&force_login=true' : ''));

    return (
      <div className={classes.root}>
        <div className={classes.bannerBox}>
          <Typography variant="h2" className={classes.banner}>
            OPN Reconciliation
          </Typography>
          <Typography variant="h4" className={classes.signin}>
            <a href={url}>Sign In</a>
          </Typography>
          <Typography variant="body1" className={classes.serviceLine}>
            Version {process.env.REACT_APP_VERSION} -
            Using the OPN Platform at <a href={platformURL}>{platformURL}</a>
          </Typography>
        </div>
      </div>
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


export default compose(
  withStyles(styles, {withTheme: true}),
  connect(mapStateToProps),
)(LoginView);
