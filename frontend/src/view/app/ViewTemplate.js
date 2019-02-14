import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import LayoutConfig from '../app/LayoutConfig';
import OPNAppBar from './OPNAppBar';
import PropTypes from 'prop-types';
import React from 'react';


const styles = {
  content: {
    padding: '16px',
  },
};


class ViewTemplate extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
  };

  render() {
    const {
      classes,
    } = this.props;

    return (
      <div className={classes.root}>
        <LayoutConfig title="ViewTemplate" />

        <OPNAppBar />

        <div className={classes.content}>
          ViewTemplate.js is a template for views.
        </div>
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
)(ViewTemplate);
