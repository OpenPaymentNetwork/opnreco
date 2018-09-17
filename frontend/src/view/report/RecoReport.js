
import PropTypes from 'prop-types';
import React from 'react';
import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
import { withStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';


const styles = {
  root: {
    margin: '16px auto',
    maxWidth: 800,
  },
  table: {
    width: '100%',
  },
};


class RecoReport extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    mirror: PropTypes.object,
    file: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
  }

  render() {
    const {classes, mirror, file} = this.props;
    if (!mirror) {
      // No mirror selected.
      return null;
    }

    let file_date;
    if (file) {
      file_date = file.end_date;
    } else {
      file_date = (new Date()).toLocaleDateString() + ' (unclosed)';
    }

    return (
      <div className={classes.root}>
        <Paper className={classes.tablePaper}>
          <table className={classes.table}>
            <thead>
              <tr>
                <th colSpan="4">
                  {mirror.target_title} Reconciliation Report -
                  {' '}{mirror.currency}
                  {' '}{mirror.loop_id === '0' ? 'Open Loop' : mirror.loop_title}
                  {' - '}{file_date}
                </th>
              </tr>
            </thead>
          </table>
        </Paper>
      </div>
    );
  }

}

export default compose(
  withStyles(styles),
)(RecoReport);
