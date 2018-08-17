
import React from 'react';
import PropTypes from 'prop-types';
import { setCameFrom } from '../../reducer/login';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';


class LoginRedirect extends React.Component {
  componentDidMount() {
    const { history } = this.props;
    this.props.setCameFrom(history.location);
    history.push('/login');
  }

  render() {
    return <p style={{opacity: 0.1}}>Redirecting&hellip;</p>;
  }
}

LoginRedirect.propTypes = {
  history: PropTypes.object.isRequired,
  setCameFrom: PropTypes.func.isRequired,
};

const dispatchToProps = {
  setCameFrom,
};

export default withRouter(connect(null, dispatchToProps)(LoginRedirect));
