
import React from 'react';
import PropTypes from 'prop-types';
import { setCameFrom } from '../../reducer/camefrom';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';


class LoginRedirect extends React.Component {
  componentDidMount() {
    const { history } = this.props;
    this.props.setCameFrom(history.location);
    history.push('/login');
  }

  render() {
    return null;
  }
}

LoginRedirect.propTypes = {
  history: PropTypes.object.isRequired,
  setCameFrom: PropTypes.func.isRequired,
};

const dispatchToProps = {
  setCameFrom,
};

export default connect(null, dispatchToProps)(withRouter(LoginRedirect));
