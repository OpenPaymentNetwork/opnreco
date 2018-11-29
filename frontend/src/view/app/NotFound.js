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


class NotFound extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
  };

  render() {
    const {classes} = this.props;

    return (
      <div className={classes.root}>
        <LayoutConfig title="Page Not Found" />

        <OPNAppBar />

        <div className={classes.content}>
          Sorry, this page could not be found.
        </div>
      </div>
    );
  }
}

export default withStyles(styles)(NotFound);
