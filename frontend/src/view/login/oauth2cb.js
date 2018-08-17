
import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import { parse } from 'query-string';
import { logIn, setCameFrom, clearOAuthState } from '../../reducer/login';
import { withRouter } from 'react-router';


class OAuth2CallbackView extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
    const parsed = parse(window.location.hash);
    this.setState({parsed});
    if (parsed.access_token && parsed.state === this.props.oauthState) {
      this.props.clearOAuthState();
      this.props.logIn(parsed.access_token);
      const cameFrom = this.props.cameFrom;
      if (cameFrom) {
        this.props.setCameFrom(null);
        window.setTimeout(() => this.props.history.push(cameFrom), 0);
      } else {
        this.props.history.push('/');
      }
    }
  }

  render() {
    return <p style={{opacity: 0.1}}>Logging in&hellip;</p>;
  }
}

OAuth2CallbackView.propTypes = {
  history: PropTypes.object.isRequired,
  logIn: PropTypes.func.isRequired,
  setCameFrom: PropTypes.func.isRequired,
  clearOAuthState: PropTypes.func.isRequired,
  deviceUUID: PropTypes.string,
  oauthState: PropTypes.string,
  cameFrom: PropTypes.string,
};

function mapStateToProps(state) {
  return {
    oauthState: state.login.oauthState,
    cameFrom: state.login.cameFrom,
  };
}

const dispatchToProps = {
  logIn,
  setCameFrom,
  clearOAuthState,
};

export default withRouter(
  connect(mapStateToProps, dispatchToProps)(OAuth2CallbackView));
