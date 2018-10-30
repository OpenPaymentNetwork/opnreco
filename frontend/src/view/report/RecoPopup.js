
import { withStyles } from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import React from 'react';


const styles = {
};


class RecoPopup extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
  };

  render() {
    return 'hi';
  }
}


export default withStyles(styles)(RecoPopup);
