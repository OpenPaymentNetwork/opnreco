
import { binder } from '../../util/binder';
import { closeRecoPopover } from '../../reducer/report';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fetchcache } from '../../reducer/fetchcache';
import { fOPNReport } from '../../util/fetcher';
import { getPloopAndFile } from '../../util/ploopfile';
import { withRouter } from 'react-router';
import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Close from '@material-ui/icons/Close';
import Fade from '@material-ui/core/Fade';
import IconButton from '@material-ui/core/IconButton';
import MovementTableBody from './MovementTableBody';
import Popover from '@material-ui/core/Popover';
import PropTypes from 'prop-types';
import React from 'react';
import Require from '../../util/Require';
import Typography from '@material-ui/core/Typography';


const styles = theme => ({
  popoverContent: {
    minWidth: '700px',
  },
  titleBar: {
    backgroundColor: theme.palette.primary.main,
    color: '#fff',
    paddingLeft: '16px',
    fontSize: '1.0rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeButton: {
    color: '#fff',
  },
  content: {
    padding: '16px',
  },
  actionBox: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0 16px 16px 16px',
  },
  actionLeftButtons: {
    flexGrow: 2,
  },
  table: {
    borderCollapse: 'collapse',
    width: '100%',
  },
  headCell: {
    backgroundColor: '#ddd',
    border: '1px solid #bbb',
    fontWeight: 'normal',
  },
  head2Cell: {
    backgroundColor: '#ddd',
    border: '1px solid #bbb',
    fontWeight: 'normal',
  },
  spaceRow: {
    height: '16px',
  },
  actionHeadCell: {
    backgroundColor: '#ddd',
    border: '1px solid #bbb',
    textAlign: 'center',
  },
});


class RecoPopover extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    open: PropTypes.bool,
    anchorEl: PropTypes.object,
    fileId: PropTypes.string,
    ploopKey: PropTypes.string,
    recoId: PropTypes.string,
    recoURL: PropTypes.string.isRequired,
    recoCompleteURL: PropTypes.string,
    reco: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.binder = binder(this);
    this.state = {
      reco: null,             // reco state initially copied from the props
      undo: [],               // List of reco states
      popoverActions: null,
      resetCount: 0,
    };
  }

  componentDidUpdate(prevProps) {
    let reco = this.state.reco;
    let initializing = false;

    if (this.props.open && !prevProps.open) {
      // Clear the old reco state.
      reco = null;
      initializing = true;
    }

    if (!reco && this.props.reco) {
      // Initialize the reco state.
      reco = this.props.reco;
      initializing = true;
    }

    if (initializing) {
      this.setState({
        reco,
        undo: [],
      });
      this.updatePopoverPosition();
    }
  }

  handleActionCallback(popoverActions) {
    this.setState({popoverActions});
  }

  updatePopoverPosition() {
    const {popoverActions} = this.state;
    if (popoverActions && popoverActions.updatePosition) {
      popoverActions.updatePosition();
    }
  }

  handleClose() {
    this.props.dispatch(closeRecoPopover());
  }

  handleUndo() {
    const {
      resetCount,
      undo,
    } = this.state;

    if (!undo || !undo.length) {
      return;
    }

    const len1 = undo.length - 1;
    this.setState({
      reco: undo[len1],
      undo: undo.slice(0, len1),
      // Search results can contain the same items as restored rows,
      // so close any active searches by incrementing resetCount.
      resetCount: resetCount + 1,
    });

    this.updatePopoverPosition();
  }

  changeMovements(movements) {
    const {reco, undo} = this.state;
    this.setState({
      reco: {...reco, movements},
      undo: [...undo, reco],
    });
  }

  renderTable() {
    const {
      classes,
      fileId,
      ploopKey,
    } = this.props;

    const {
      reco,
      resetCount,
    } = this.state;

    if (!reco) {
      return <CircularProgress />;
    }

    const accountEntryRows = [];

    return (
      <table className={classes.table}>
        <tbody>
          <tr>
            <th colSpan="4"className={classes.headCell}>Account Entries</th>
          </tr>
          <tr>
            <th width="10%" className={classes.actionHeadCell}></th>
            <th width="25%" className={classes.head2Cell}>Amount</th>
            <th width="25%" className={classes.head2Cell}>Date</th>
            <th width="30%" className={classes.head2Cell}>Description</th>
          </tr>
          {accountEntryRows}
          <tr>
            <td colSpan="4" className={classes.searchCell}></td>
          </tr>
        </tbody>

        <tbody>
          <tr>
            <td colSpan="4" className={classes.spaceRow}></td>
          </tr>
        </tbody>

        <MovementTableBody
          dispatch={this.props.dispatch}
          fileId={fileId}
          ploopKey={ploopKey}
          movements={reco.movements}
          updatePopoverPosition={this.binder(this.updatePopoverPosition)}
          changeMovements={this.binder(this.changeMovements)}
          isCirc={reco.is_circ}
          resetCount={resetCount}
        />
      </table>
    );
  }

  render() {
    const {
      classes,
      open,
      anchorEl,
      recoId,
      recoURL,
      recoCompleteURL,
    } = this.props;

    const {
      undo,
    } = this.state;

    let require = null;
    if (recoURL) {
      const requireURLs = [recoURL];
      if (recoCompleteURL) {
        requireURLs.push(recoCompleteURL);
      }
      require = <Require urls={requireURLs} fetcher={fOPNReport} />;
    }

    return (
      <Popover
        id="reco-popover"
        open={open}
        anchorEl={anchorEl}
        onClose={this.binder(this.handleClose)}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        TransitionComponent={Fade}
        action={this.binder(this.handleActionCallback)}
      >
        {require}
        <div className={classes.popoverContent}>
          <Typography variant="h6" className={classes.titleBar}>
            <span className={classes.popoverTitle}>Reconciliation {recoId}</span>
            <IconButton
              className={classes.closeButton}
              onClick={this.binder(this.handleClose)}
            >
              <Close />
            </IconButton>
          </Typography>
          <Typography className={classes.content} component="div">
            {this.renderTable()}
          </Typography>
          <div className={classes.actionBox}>
            <div className={classes.actionLeftButtons}>
              <Button
                disabled={!undo || !undo.length}
                onClick={this.binder(this.handleUndo)}>Undo</Button>
            </div>
            {recoId ?
              <Button>Remove</Button>
              : null}
            <Button color="primary">Save</Button>
          </div>
        </div>
      </Popover>
    );
  }
}


function mapStateToProps(state) {
  const {ploop, file} = getPloopAndFile(state);
  const ploopKey = ploop.ploop_key;
  const fileId = file ? file.file_id : 'current';
  const {recoPopover} = state.report;
  const {recoId, movementId, accountEntryId} = recoPopover;
  let recoURL, reco;
  let recoCompleteURL = null;

  if (ploop) {
    const query = (
      `ploop_key=${encodeURIComponent(ploopKey)}` +
      `&file_id=${encodeURIComponent(fileId)}` +
      `&movement_id=${encodeURIComponent(movementId || '')}` +
      `&reco_id=${encodeURIComponent(recoId || '')}` +
      `&account_entry_id=${encodeURIComponent(accountEntryId || '')}`);
    recoURL = fOPNReport.pathToURL(`/reco?${query}`);
    reco = fetchcache.get(state, recoURL);

    if (reco) {
      // Now that the initial record is loaded, load the complete record,
      // which often takes longer because it updates all profiles and loops.
      recoCompleteURL = fOPNReport.pathToURL(`/reco-complete?${query}`);
      const recoComplete = fetchcache.get(state, recoCompleteURL);
      if (recoComplete) {
        reco = recoComplete;
      }
    }

  } else {
    recoURL = '';
    reco = null;
  }

  return {
    ...recoPopover,
    recoURL,
    recoCompleteURL,
    reco,
    ploopKey,
    fileId,
  };
}


export default compose(
  withStyles(styles, {withTheme: true}),
  withRouter,
  connect(mapStateToProps),
)(RecoPopover);
