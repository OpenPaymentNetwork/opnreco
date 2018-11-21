
import { binder } from '../../util/binder';
import { clearMost } from '../../reducer/clearmost';
import { compose } from '../../util/functional';
import { connect } from 'react-redux';
import { fetchcache } from '../../reducer/fetchcache';
import { fOPNReport } from '../../util/fetcher';
import { getPloopAndFile } from '../../util/ploopfile';
import { throttler } from '../../util/throttler';
import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Close from '@material-ui/icons/Close';
import Fade from '@material-ui/core/Fade';
import FormControl from '@material-ui/core/FormControl';
import IconButton from '@material-ui/core/IconButton';
import MenuItem from '@material-ui/core/MenuItem';
import MovementTableBody from './MovementTableBody';
import Popover from '@material-ui/core/Popover';
import PropTypes from 'prop-types';
import React from 'react';
import Redo from '@material-ui/icons/Redo';
import Require from '../../util/Require';
import Select from '@material-ui/core/Select';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import Undo from '@material-ui/icons/Undo';


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
  metadataBox: {
    display: 'flex',
    marginBottom: '16px',
    justifyContent: 'space-between',
  },
  typeControl: {
    marginRight: '32px',
  },
  commentControl: {
    flexGrow: '1',
  },
});


class RecoPopover extends React.Component {
  static propTypes = {
    classes: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    close: PropTypes.func.isRequired,
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
      undoLog: [],            // List of reco states
      redoLog: [],            // List of reco states
      popoverActions: null,
      resetCount: 0,
      typingComment: null,
      saving: false,
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
        undoLog: [],
        redoLog: [],
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

  /**
   * Commit all changes to state.reco and return the updated reco.
   * (Note: this does not save the changes on the server.)
   */
  commit() {
    const {typingComment, reco, undoLog} = this.state;
    let newReco = reco;
    let changed = false;

    if (typingComment !== null && typingComment !== undefined &&
        typingComment !== reco.comment) {
      // Commit the comment and record in the undo log.
      newReco = {...reco, comment: typingComment};
      changed = true;
    }

    if (changed) {
      this.setState({
        reco: newReco,
        typingComment: null,
        undoLog: [...undoLog, reco],
        redoLog: [],
      });
      this.updatePopoverPosition();
    }

    return newReco;
  }

  handleUndo() {
    const {
      resetCount,
      undoLog,
      redoLog,
    } = this.state;

    if (!undoLog.length) {
      return;
    }

    const reco = this.commit();

    const newRedoLog = redoLog.slice();
    newRedoLog.push(reco);

    const len1 = undoLog.length - 1;
    this.setState({
      reco: undoLog[len1],
      undoLog: undoLog.slice(0, len1),
      redoLog: newRedoLog,
      // Search results can contain the same items as restored rows,
      // so close any active searches by incrementing resetCount.
      resetCount: resetCount + 1,
    });

    this.updatePopoverPosition();
  }

  handleRedo() {
    const {
      reco,
      resetCount,
      undoLog,
      redoLog,
    } = this.state;

    if (!redoLog.length) {
      return;
    }

    const newUndoLog = undoLog.slice();
    newUndoLog.push(reco);

    const len1 = redoLog.length - 1;
    this.setState({
      reco: redoLog[len1],
      redoLog: redoLog.slice(0, len1),
      undoLog: newUndoLog,
      // Search results can contain the same items as restored rows,
      // so close any active searches by incrementing resetCount.
      resetCount: resetCount + 1,
    });

    this.updatePopoverPosition();
  }

  /**
   * Accept a change to the reco's movement list.
   */
  changeMovements(movements) {
    const {reco, undoLog} = this.state;
    this.setState({
      reco: {...reco, movements},
      undoLog: [...undoLog, reco],
      redoLog: [],
    });
  }

  /**
   * Accept a change to the reco_type.
   */
  handleRecoType(event) {
    const {reco, undoLog} = this.state;
    this.setState({
      reco: {...reco, reco_type: event.target.value},
      undoLog: [...undoLog, reco],
      redoLog: [],
    });
  }

  handleComment(event) {
    this.setState({
      typingComment: event.target.value,
      redoLog: [],
    });
    this.getCommitThrottler()();
  }

  getCommitThrottler() {
    let t = this.commitThrottler;
    if (!t) {
      t = throttler(this.commit.bind(this), 400);
      this.commitThrottler = t;
    }
    return t;
  }

  /**
   * Commit and save the changes.
   */
  handleSave() {
    const {
      ploopKey,
      fileId,
      recoId,
      dispatch,
    } = this.props;

    const reco = this.commit();

    const url = fOPNReport.pathToURL('/reco-save' +
      `?ploop_key=${encodeURIComponent(ploopKey)}` +
      `&file_id=${encodeURIComponent(fileId)}`);
    const data = {
      reco,
      reco_id: recoId,
    };

    const promise = this.props.dispatch(fOPNReport.fetch(url, {data}));
    this.setState({saving: true});
    promise.then(() => {
      this.props.close();
      dispatch(clearMost());
    }).finally(() => {
      this.setState({saving: false});
    });
  }

  renderTable() {
    const {
      classes,
      fileId,
      ploopKey,
      recoURL,
      recoId,
      close,
    } = this.props;

    const {
      reco,
      resetCount,
    } = this.state;

    if (!recoURL) {
      // No reco specified and nothing is currently loading. Show nothing.
      return null;
    }

    if (!reco) {
      return <CircularProgress />;
    }

    const accountEntryRows = [];
    const isCirc = reco.is_circ;
    const recoType = reco.reco_type;
    const colCount = isCirc ? 5 : 4;

    let headRow;
    if (isCirc) {
      headRow = (
        <tr>
          <th width="10%" className={classes.actionHeadCell}></th>
          <th className={classes.head2Cell} colSpan="2">Amount</th>
          <th width="25%" className={classes.head2Cell}>Date</th>
          <th width="35%" className={classes.head2Cell}>Description</th>
        </tr>
      );
    } else {
      headRow = (
        <tr>
          <th width="10%" className={classes.actionHeadCell}></th>
          <th width="15%" className={classes.head2Cell}>Amount</th>
          <th width="25%" className={classes.head2Cell}>Date</th>
          <th width="50%" className={classes.head2Cell}>Description</th>
        </tr>
      );
    }

    let accountTableBody = null;
    if (recoType !== 'wallet_only') {
      accountTableBody = (
        <tbody>
          <tr>
            <th colSpan={colCount} className={classes.headCell}>Account Entries</th>
          </tr>
          {headRow}
          {accountEntryRows}
          <tr>
            <td colSpan={colCount} className={classes.searchCell}></td>
          </tr>
          <tr>
            <td colSpan={colCount} className={classes.spaceRow}></td>
          </tr>
        </tbody>
      );
    }

    let movementTableBody = null;
    if (recoType !== 'account_only') {
      movementTableBody = (
        <MovementTableBody
          dispatch={this.props.dispatch}
          fileId={fileId}
          ploopKey={ploopKey}
          movements={reco.movements}
          updatePopoverPosition={this.binder(this.updatePopoverPosition)}
          changeMovements={this.binder(this.changeMovements)}
          isCirc={isCirc}
          resetCount={resetCount}
          close={close}
          recoId={recoId}
        />
      );
    }

    return (
      <table className={classes.table}>
        {accountTableBody}
        {movementTableBody}
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
      reco,
      typingComment,
      undoLog,
      redoLog,
      saving,
    } = this.state;

    let require = null;
    if (recoURL && open) {
      const requireURLs = [recoURL];
      if (recoCompleteURL) {
        requireURLs.push(recoCompleteURL);
      }
      require = <Require urls={requireURLs} fetcher={fOPNReport} />;
    }

    let comment = '';
    if (typingComment !== null && typingComment !== undefined) {
      comment = typingComment;
    } else {
      comment = (reco ? reco.comment || '' : '');
    }

    return (
      <Popover
        id="reco-popover"
        open={open}
        anchorEl={anchorEl}
        onClose={this.props.close}
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
              onClick={this.props.close}
            >
              <Close />
            </IconButton>
          </Typography>
          <Typography className={classes.content} component="div">
            <div className={classes.metadataBox}>

              <FormControl className={classes.typeControl}>
                <Select
                  name="reco_type"
                  value={reco ? reco.reco_type : 'standard'}
                  displayEmpty
                  onChange={this.binder(this.handleRecoType)}
                >
                  <MenuItem value="standard">Standard Reconciliation</MenuItem>
                  <MenuItem value="wallet_only">Wallet Income/Expense</MenuItem>
                  <MenuItem value="account_only">Account Credit/Debit</MenuItem>
                </Select>
              </FormControl>

              <FormControl className={classes.commentControl}>
                <TextField
                  name="comment"
                  placeholder="Comment"
                  value={comment}
                  onChange={this.binder(this.handleComment)}
                  multiline
                />
              </FormControl>

            </div>
            {this.renderTable()}
            <div className={classes.actionBox}>
              <div className={classes.actionLeftButtons}>
                <IconButton
                  disabled={!undoLog.length}
                  onClick={this.binder(this.handleUndo)}
                >
                  <Undo/>
                </IconButton>
                <IconButton
                  disabled={!redoLog.length}
                  onClick={this.binder(this.handleRedo)}
                >
                  <Redo/>
                </IconButton>
              </div>
              <Button
                color="primary"
                disabled={saving}
                onClick={this.binder(this.handleSave)}>Save</Button>
            </div>
          </Typography>
        </div>
      </Popover>
    );
  }
}


function mapStateToProps(state, ownProps) {
  const {ploop, file} = getPloopAndFile(state);
  const ploopKey = ploop ? ploop.ploop_key : '';
  const fileId = file ? file.file_id : 'current';
  let recoURL, reco;
  let recoCompleteURL = null;

  if (ploop) {
    const query = (
      `ploop_key=${encodeURIComponent(ploopKey)}` +
      `&file_id=${encodeURIComponent(fileId)}` +
      `&movement_id=${encodeURIComponent(ownProps.movementId || '')}` +
      `&reco_id=${encodeURIComponent(ownProps.recoId || '')}` +
      `&account_entry_id=${encodeURIComponent(ownProps.accountEntryId || '')}`);
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
    recoURL,
    recoCompleteURL,
    reco,
    ploopKey,
    fileId,
  };
}


export default compose(
  withStyles(styles, {withTheme: true}),
  connect(mapStateToProps),
)(RecoPopover);
