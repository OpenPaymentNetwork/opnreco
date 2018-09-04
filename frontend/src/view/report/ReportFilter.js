
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import Select from '@material-ui/core/Select';
import { binder } from '../../util/binder';
import { withStyles } from '@material-ui/core/styles';


const styles = {
  root: {
    display: 'flex',
    float: 'right',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    flexWrap: 'wrap-reverse',
    padding: '0 8px',
    margin: '0 16px 16px 16px',
  },
  controlBox: {
    padding: 16,
  },
};


class ReportFilter extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    onlyCirculating: PropTypes.bool,
    dateRange: PropTypes.bool,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
  }

  render() {
    const {classes} = this.props;


    return (
      <Paper className={classes.root}>
        <div className={classes.controlBox}>
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
        <div className={classes.controlBox}>
          <FormControl>
            <InputLabel htmlFor="filter-date">Date range</InputLabel>
            <Select
              value="2018-06-01--2018-06-30"
              inputProps={{
                id: 'filter-date',
              }}
            >
              <MenuItem value="2018-06-01--2018-06-30">June 2018</MenuItem>
              <MenuItem value="2018-07-01--2018-07-31">July 2018</MenuItem>
              <MenuItem value="2018-08-01--2018-08-31">August 2018</MenuItem>
              <MenuItem value="custom">Custom Range&hellip;</MenuItem>
            </Select>
          </FormControl>
        </div>
      </Paper>
    );
  }
}


export default withStyles(styles)(ReportFilter);
