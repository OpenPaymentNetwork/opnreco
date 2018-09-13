import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReport } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { setFileId, setMirrorId } from '../../reducer/report';
import { withStyles } from '@material-ui/core/styles';
import FormControl from '@material-ui/core/FormControl';
import MenuItem from '@material-ui/core/MenuItem';
import Paper from '@material-ui/core/Paper';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import Select from '@material-ui/core/Select';


const styles = theme => ({
  root: {
    [theme.breakpoints.up('lg')]: {
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
    },
  },
  controlBox: {
    padding: 16,
  },
  mirrorSelect: {
    [theme.breakpoints.up('lg')]: {
      minWidth: 400,
    },
  },
  fileSelect: {
  },
});

const mirrorsAndFilesURL = fOPNReport.pathToURL('/mirrors-and-files');


class ReportFilter extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    fileId: PropTypes.string,
    mirrorId: PropTypes.string,
    mirrors: PropTypes.object,
    mirrorOrder: PropTypes.array,
    mirrorsLoading: PropTypes.bool,
    mirrorsError: PropTypes.bool,
    defaultMirror: PropTypes.string,
    syncProgress: PropTypes.any,
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

  renderMirrorSelections() {
    const {
      mirrors,
      mirrorOrder,
      mirrorId,
      mirrorsLoading,
      mirrorsError,
      defaultMirror,
      syncProgress,
    } = this.props;
    let mirrorSelections;
    let selectedMirrorId = mirrorId;

    if (mirrorOrder && mirrorOrder.length) {
      mirrorSelections = mirrorOrder.map(mirrorId => {
        const mirror = mirrors[mirrorId];
        let targetType;
        if (mirror.target_id === 'c') {
          targetType = 'Circulation';
        } else if (mirror.target_is_account) {
          targetType = 'Account';
        } else {
          targetType = 'Wallet';
        }
        return (
          <MenuItem value={mirrorId} key={mirrorId}>
            {mirror.target_title} ({targetType}):
            {' '}{mirror.currency}
            {' '}{mirror.loop_id === '0' ? 'Open Loop' : mirror.loop_title}
          </MenuItem>
        );
      });

      if (!selectedMirrorId) {
        if (mirrorOrder && mirrorOrder.length) {
          selectedMirrorId = mirrorOrder[0];
        }
      }

      if (!selectedMirrorId || !mirrors[selectedMirrorId]) {
        selectedMirrorId = defaultMirror || '';
      }

    } else {

      let errorMessage;
      if (mirrorsLoading) {
        errorMessage = <em>Loading accounts&hellip;</em>;
      } else if (mirrorsError) {
        errorMessage = <em>Unable to load account list</em>;
      } else if (syncProgress !== null) {
        errorMessage = <em>Syncing&hellip;</em>;
      } else {
        errorMessage = <em>No accounts found</em>;
      }

      mirrorSelections = [
        <MenuItem value="none" key="">
          {errorMessage}
        </MenuItem>
      ];
      selectedMirrorId = 'none';
    }

    return {
      mirrorSelections,
      selectedMirrorId,
    };
  }

  render() {
    const {
      classes,
      fileId,
    } = this.props;

    const {
      mirrorSelections,
      selectedMirrorId,
    } = this.renderMirrorSelections();

    return (
      <Paper className={classes.root}>
        <Require fetcher={fOPNReport} urls={[mirrorsAndFilesURL]} />
        <div className={classes.controlBox}>
          <FormControl>
            <Select
              className={classes.mirrorSelect}
              value={selectedMirrorId}
              onChange={this.binder(this.handleMirrorChange)}
              inputProps={{
                id: 'filter-mirror',
              }}
            >
              {mirrorSelections}
            </Select>
          </FormControl>
        </div>
        <div className={classes.controlBox}>
          <FormControl>
            <Select
              className={classes.fileSelect}
              value={fileId || 'current'}
              onChange={this.binder(this.handleFileChange)}
              inputProps={{
                id: 'filter-file',
              }}
            >
              <MenuItem value="current">Current File</MenuItem>
              {/* TODO: list the files */}
            </Select>
          </FormControl>
        </div>
      </Paper>
    );
  }
}


function mapStateToProps(state) {
  const {mirrorId, fileId} = state.report;
  const mirrorsAndFiles = fetchcache.get(state, mirrorsAndFilesURL) || {};
  const mirrorsLoading = fetchcache.fetching(state, mirrorsAndFilesURL);
  const mirrorsError = !!fetchcache.getError(state, mirrorsAndFilesURL);
  return {
    mirrorId,
    fileId,
    mirrorsAndFilesURL,
    mirrors: mirrorsAndFiles.mirrors || {},
    mirrorOrder: mirrorsAndFiles.mirror_order || [],
    mirrorsLoading,
    mirrorsError,
    defaultMirror: mirrorsAndFiles.default_mirror,
    syncProgress: state.app.syncProgress,
  };
}


export default compose(
  withStyles(styles, {withTheme: true}),
  connect(mapStateToProps),
)(ReportFilter);
