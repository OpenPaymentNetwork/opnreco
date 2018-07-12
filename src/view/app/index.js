
import About from '../about';
import Home from '../home';
import LoginView from '../login';
import LoginRedirect from '../login/loginredirect';
import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import { Switch, Route } from 'react-router';


function App(props) {
  if (!props.token) {
    return (
      <Switch>
        <Route path="/login" component={LoginView} />
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

//export default connect(mapStateToProps)(App);
export default App;
