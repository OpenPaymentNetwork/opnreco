
import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import LayoutConfig from '../app/LayoutConfig';
import OPNAppBar from '../app/OPNAppBar';
import PropTypes from 'prop-types';
import React from 'react';


const styles = {
  content: {
    padding: '16px',
  },
};


class AuthenticatedHome extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
  }

  render() {
    const {
      classes,
    } = this.props;

    return (
      <div className={classes.root}>
        <LayoutConfig title="OPN Reconciliation" />

        <OPNAppBar />
      </div>
    );
  }
}

function mapStateToProps() {
  return {};
}


export default compose(
  withStyles(styles),
  withRouter,
  connect(mapStateToProps),
)(AuthenticatedHome);
