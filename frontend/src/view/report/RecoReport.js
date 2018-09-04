
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import Select from '@material-ui/core/Select';
import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';


const styles = theme => ({

});


class RecoReport extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
  }

  renderFilterControls() {
    const {classes} = this.props;
    return (
      <Paper className={classes.filterContainer}>
        <div className={classes.filterControlBox}>
          <FormControl>
            <InputLabel htmlFor="filter-mirror">Reconciliation Target</InputLabel>
            <Select
              value="c"
              inputProps={{
                id: 'filter-mirror',
              }}
            >
              <MenuItem value="c">BCB FBO Circulation: USD Open Loop</MenuItem>
              <MenuItem value="201">Zions Bank: USD Open Loop</MenuItem>
              <MenuItem value="203">RevCash Store: MXN Pokecash</MenuItem>
            </Select>
          </FormControl>
        </div>
        <div className={classes.filterControlBox}>
          <FormControl>
            <InputLabel htmlFor="filter-date">Date</InputLabel>
            <Select
              value="2018-06-30"
              inputProps={{
                id: 'filter-date',
              }}
            >
              <MenuItem value="2018-06-01--2018-06-30">30 June 2018</MenuItem>
            </Select>
          </FormControl>
        </div>
      </Paper>
    );
  }

  render() {
    const filterControls = this.renderFilterControls();

    return (
      <div>
        {filterControls}

        Reconciliation
      </div>
    );
  }

}

export default compose(
  withStyles(styles, {withTheme: true}),
)(RecoReport);
