import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReport } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { setFileId, setMirrorId } from '../../reducer/report';
import { withStyles } from '@material-ui/core/styles';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import Select from '@material-ui/core/Select';


const styles = {
  root: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
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
    mirrorsAndFilesURL: PropTypes.string.isRequired,
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
    const {classes, mirrorId, fileId, mirrorsAndFilesURL} = this.props;

    return (
      <Paper className={classes.root}>
        <Require fetcher={fOPNReport} urls={[mirrorsAndFilesURL]} />
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
  const {mirrorId, fileId} = state.report;
  const mirrorsAndFilesURL = fOPNReport.pathToURL('/mirrors-and-files');
  const mirrorsAndFiles = fetchcache.get(state, mirrorsAndFilesURL);
  return {
    mirrorId,
    fileId,
    mirrorsAndFilesURL,
    mirrorsAndFiles,
  };
}


export default compose(
  withStyles(styles),
  connect(mapStateToProps),
)(ReportFilter);
