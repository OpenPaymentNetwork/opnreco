import { binder } from '../../util/binder';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fOPNReport } from '../../util/fetcher';
import { fetchcache } from '../../reducer/fetchcache';
import { setPloopKey, setFileId } from '../../reducer/report';
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
  ploopSelect: {
    [theme.breakpoints.up('lg')]: {
      minWidth: 400,
    },
  },
  fileSelect: {
  },
});

const ploopsURL = fOPNReport.pathToURL('/ploops');


class ReportFilter extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    file: PropTypes.object,
    ploop: PropTypes.object,
    ploops: PropTypes.object,
    ploopOrder: PropTypes.array,
    loading: PropTypes.bool,
    loadError: PropTypes.bool,
    syncProgress: PropTypes.any,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
  }

  handlePloopChange(event) {
    this.props.dispatch(setPloopKey(event.target.value));
  }

  handleFileChange(event) {
    this.props.dispatch(setFileId(event.target.value));
  }

  renderPloopSelections() {
    const {
      ploops,
      ploopOrder,
      loading,
      loadError,
      syncProgress,
    } = this.props;

    if (ploopOrder && ploopOrder.length) {
      return ploopOrder.map(ploopKey => {
        const ploop = ploops[ploopKey];
        let peerType;
        if (ploop.peer_id === 'c') {
          peerType = 'Circulation';
        } else if (ploop.peer_is_dfi_account) {
          peerType = 'DFI Account';
        } else {
          peerType = 'Wallet';
        }
        return (
          <MenuItem value={ploopKey} key={ploopKey}>
            {ploop.peer_title} ({peerType}) -
            {' '}{ploop.currency}
            {' '}{ploop.loop_id === '0' ? 'Open Loop' : ploop.loop_title}
          </MenuItem>
        );
      });

    } else {
      let errorMessage;
      if (loading) {
        errorMessage = <em>Loading accounts&hellip;</em>;
      } else if (loadError) {
        errorMessage = <em>Unable to load account list</em>;
      } else if (syncProgress !== null) {
        errorMessage = <em>Syncing&hellip;</em>;
      } else {
        errorMessage = <em>No accounts found for your profile</em>;
      }
      return [
        <MenuItem value="#error" key="#error">
          {errorMessage}
        </MenuItem>
      ];
    }
  }

  renderFileSelections() {
    const {
      ploop,
    } = this.props;

    if (ploop && ploop.file_order && ploop.file_order.length) {
      return ploop.file_order.map(fileId => {
        const file = ploop.files[fileId];
        let title;
        if (file.current) {
          title = 'Current File';
        } else {
          title = file.end_date;
        }
        return <MenuItem value={fileId} key={fileId}>{title}</MenuItem>;
      });
    } else {
      return [];
    }
  }

  render() {
    const {
      classes,
      ploop,
      ploopOrder,
      file,
    } = this.props;

    const ploopSelections = this.renderPloopSelections();
    const fileSelections = this.renderFileSelections();

    let ploopValue;
    if (ploop) {
      ploopValue = ploop.ploop_key;
    } else if (ploopOrder && ploopOrder.length) {
      ploopValue = ploopOrder[0];
    } else {
      ploopValue = '#error';
    }

    let fileValue;
    if (file) {
      fileValue = file.file_id;
    } else if (ploop && ploop.file_order && ploop.file_order.length) {
      fileValue = ploop.file_order[0];
    } else {
      fileValue = '';
    }

    return (
      <Paper className={classes.root}>
        <Require fetcher={fOPNReport} urls={[ploopsURL]} />
        <div className={classes.controlBox}>
          <FormControl>
            <Select
              className={classes.ploopSelect}
              value={ploopValue}
              onChange={this.binder(this.handlePloopChange)}
              inputProps={{
                id: 'filter-ploop',
              }}
            >
              {ploopSelections}
            </Select>
          </FormControl>
        </div>
        <div className={classes.controlBox}>
          <FormControl>
            <Select
              className={classes.fileSelect}
              value={fileValue}
              onChange={this.binder(this.handleFileChange)}
              inputProps={{
                id: 'filter-file',
              }}
            >
              {fileSelections}
            </Select>
          </FormControl>
        </div>
      </Paper>
    );
  }
}


function mapStateToProps(state) {
  const fetched = fetchcache.get(state, ploopsURL) || {};
  const loading = fetchcache.fetching(state, ploopsURL);
  const loadError = !!fetchcache.getError(state, ploopsURL);
  return {
    ploopsURL,
    ploops: fetched.ploops || {},
    ploopOrder: fetched.ploop_order || [],
    loading,
    loadError,
    syncProgress: state.app.syncProgress,
  };
}


export default compose(
  withStyles(styles, {withTheme: true}),
  connect(mapStateToProps),
)(ReportFilter);
