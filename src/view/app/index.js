
import About from '../about';
import Home from '../home';
import LoginView from '../login';
import LoginRedirect from '../login/loginredirect';
import OAuth2CallbackView from '../login/oauth2cb';
import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import { Switch, Route } from 'react-router';
import { withRouter } from 'react-router';


function App(props) {
  if (!props.token) {
    return (
      <Switch>
        <Route path="/login" component={LoginView} />
        <Route path="/oauth2cb" component={OAuth2CallbackView} />
        <Route component={LoginRedirect} />
      </Switch>
    );
  }

  return (
    <div>
      <header>
        <Link to="/">Home</Link>
        <Link to="/about-us">About</Link>
      </header>

      <main>
        <Route exact path="/" component={Home} />
        <Route exact path="/about-us" component={About} />
      </main>
    </div>
  );
}

App.propTypes = {
  token: PropTypes.string,
};

const mapStateToProps = (state) => ({
  token: state.login.token,
});


// withRouter() seems to be required for any component containing Routes. See:
// https://github.com/ReactTraining/react-router/issues/4671
export default withRouter(connect(mapStateToProps)(App));
