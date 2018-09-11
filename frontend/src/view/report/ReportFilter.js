import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { setFileId, setMirrorId } from '../../reducer/report';
import { withStyles } from '@material-ui/core/styles';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import Select from '@material-ui/core/Select';


const styles = {
  root: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    flexWrap: 'wrap-reverse',
    padding: '0 8px',
  },
  controlBox: {
    padding: 16,
  },
};


class ReportFilter extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    fileId: PropTypes.string,
    mirrorId: PropTypes.string,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
  }

  handleMirrorChange(event) {
    this.props.dispatch(setMirrorId(event.target.value));
  }

  handleFileChange(event) {
    this.props.dispatch(setFileId(event.target.value));
  }

  render() {
    const {classes, mirrorId, fileId} = this.props;

    return (
      <Paper className={classes.root}>
        <div className={classes.controlBox}>
          <FormControl>
            <InputLabel htmlFor="filter-mirror">Account</InputLabel>
            <Select
              value={mirrorId || 'c'}
              onChange={this.binder(this.handleMirrorChange)}
              inputProps={{
                id: 'filter-mirror',
              }}
            >
              <MenuItem value="c">BCB FBO circulation: USD Open Loop</MenuItem>
              <MenuItem value="201">Zions Bank: USD Open Loop</MenuItem>
              <MenuItem value="203">RevCash Store: MXN Pokecash</MenuItem>
            </Select>
          </FormControl>
        </div>
        <div className={classes.controlBox}>
          <FormControl>
            <InputLabel htmlFor="filter-file">File</InputLabel>
            <Select
              value={fileId || 'current'}
              onChange={this.binder(this.handleFileChange)}
              inputProps={{
                id: 'filter-date',
              }}
            >
              <MenuItem value="current">Current</MenuItem>
              <MenuItem value="505">June 2018</MenuItem>
              <MenuItem value="510">July 2018</MenuItem>
              <MenuItem value="519">August 2018</MenuItem>
              <MenuItem value="other">Other Files&hellip;</MenuItem>
            </Select>
          </FormControl>
        </div>
      </Paper>
    );
  }
}


function mapStateToProps(state) {
  return state.report;
}


export default compose(
  withStyles(styles),
  connect(mapStateToProps),
)(ReportFilter);
